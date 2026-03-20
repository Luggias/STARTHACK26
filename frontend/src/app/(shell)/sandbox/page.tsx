"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/game-store";
import { ASSET_CLASSES, ASSET_CLASS_KEYS } from "@/lib/constants";
import type { AssetClassKey } from "@/lib/constants";
import type { Strategy } from "@/lib/types";
import { BattleArena } from "./battle";
import { quickmatch, getBattle, presenceHeartbeat, presenceOnline, presenceChallenge, presenceGetChallenges, presenceAccept, presenceDecline, claimUsername } from "@/lib/api";
import type { OnlinePlayer } from "@/lib/ws";

/* ══════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════ */
type Selections = Record<AssetClassKey, string[]>;
type Level      = 1 | 2 | 3;
type BuildStep  = 0 | 1 | 2 | 3 | 4;
type TestStep   = "horizon" | "events" | "results";

const LEVEL_LABELS: Record<Level, string> = { 1: "LOW", 2: "MED", 3: "HIGH" };
const LEVEL_UNITS:  Record<Level, number> = { 1: 1,    2: 2,    3: 4    };
const HORIZONS = [1, 3, 5, 10, 20] as const;

/* ══════════════════════════════════════════════
   EVENTS
══════════════════════════════════════════════ */
interface GameEvent {
  key: string;
  label: string;
  type: "positive" | "negative";
  description: string;
  shocks: Partial<Record<AssetClassKey, number>>;
}

const GAME_EVENTS: GameEvent[] = [
  { key: "tech_boom",        type: "positive", label: "Tech Boom",
    description: "AI and semiconductor breakthroughs drive equity markets to new highs.",
    shocks: { equities: 0.28, etfs: 0.22, bonds: -0.03, commodities: 0.02 } },
  { key: "rate_cut",         type: "positive", label: "Rate Cut",
    description: "Central banks slash rates — borrowing is cheap, growth assets rally.",
    shocks: { equities: 0.18, etfs: 0.15, bonds: 0.22, commodities: 0.04 } },
  { key: "economic_boom",    type: "positive", label: "Economic Boom",
    description: "GDP surges, unemployment hits record lows, corporate earnings beat.",
    shocks: { equities: 0.24, etfs: 0.20, bonds: -0.04, commodities: 0.14 } },
  { key: "commodity_cycle",  type: "positive", label: "Commodity Supercycle",
    description: "Global infrastructure boom drives demand for metals and energy.",
    shocks: { equities: 0.05, etfs: 0.06, bonds: 0.01, commodities: 0.40 } },
  { key: "peace_deal",       type: "positive", label: "Peace Deal",
    description: "Major conflict resolved. Risk appetite surges, safe havens fall.",
    shocks: { equities: 0.20, etfs: 0.17, bonds: 0.08, commodities: -0.12 } },
  { key: "innovation_wave",  type: "positive", label: "Innovation Wave",
    description: "Breakthroughs in clean energy and biotech create new market leaders.",
    shocks: { equities: 0.16, etfs: 0.20, bonds: 0.02, commodities: 0.05 } },

  { key: "war",              type: "negative", label: "War & Conflict",
    description: "Military conflict disrupts supply chains. Gold and oil spike.",
    shocks: { equities: -0.30, etfs: -0.25, bonds: -0.15, commodities: 0.40 } },
  { key: "recession",        type: "negative", label: "Recession",
    description: "Economy contracts. Unemployment spikes. Consumer spending collapses.",
    shocks: { equities: -0.40, etfs: -0.35, bonds: 0.10, commodities: -0.22 } },
  { key: "rate_hike",        type: "negative", label: "Aggressive Rate Hike",
    description: "Central banks raise rates sharply — bonds and growth stocks hammered.",
    shocks: { equities: -0.22, etfs: -0.19, bonds: -0.28, commodities: 0.04 } },
  { key: "inflation_surge",  type: "negative", label: "Inflation Surge",
    description: "Inflation hits multi-decade highs. Real returns on bonds turn negative.",
    shocks: { equities: -0.18, etfs: -0.15, bonds: -0.32, commodities: 0.28 } },
  { key: "market_crash",     type: "negative", label: "Market Crash",
    description: "Panic selling triggers a broad collapse. Gold and bonds catch the fear.",
    shocks: { equities: -0.50, etfs: -0.44, bonds: 0.08, commodities: 0.12 } },
  { key: "pandemic",         type: "negative", label: "Pandemic",
    description: "Global health crisis halts economic activity worldwide for months.",
    shocks: { equities: -0.38, etfs: -0.33, bonds: 0.07, commodities: -0.25 } },
];

const POS_EVENTS = GAME_EVENTS.filter((e) => e.type === "positive");
const NEG_EVENTS = GAME_EVENTS.filter((e) => e.type === "negative");

/* ══════════════════════════════════════════════
   SIMULATION
══════════════════════════════════════════════ */
const SIM_PARAMS: Record<AssetClassKey, { mu: number; sigma: number }> = {
  equities:    { mu: 0.06, sigma: 0.22 },  // good upside but crashes hard
  etfs:        { mu: 0.055, sigma: 0.17 }, // slightly smoother than single stocks
  bonds:       { mu: 0.020, sigma: 0.07 }, // low but stable
  commodities: { mu: 0.030, sigma: 0.24 }, // volatile, low base drift
};

function runSim(
  allocation: Record<string, number>,
  years: number,
  events: { event: GameEvent; atYear: number }[],
  seed: number,
): { values: number[]; totalReturn: number; finalValue: number } {
  // Seeded LCG — seed varies per run so results aren't deterministic
  let s = (seed ^ 0xdeadbeef) >>> 0;
  const rand  = () => { s = Math.imul(1664525, s) + 1013904223 >>> 0; return s / 4294967296; };
  const randn = () => Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-10))) * Math.cos(2 * Math.PI * rand());

  // Concentration penalty: single-asset bets are far more volatile
  const maxAlloc  = Math.max(...Object.values(allocation));
  const concMult  = maxAlloc >= 80 ? 1.6 : maxAlloc >= 60 ? 1.3 : 1.0;

  const months = years * 12;
  // Front-load shocks: 70% hits in month 0, 20% month 1, 10% month 2
  // This reflects how real crashes are sudden, not gradual
  const SHOCK_W = [0.70, 0.20, 0.10];
  const shockAt = new Map<number, { ev: GameEvent; w: number }[]>();
  events.forEach(({ event: ev, atYear }) => {
    const start = Math.round(atYear * 12);
    SHOCK_W.forEach((w, d) => {
      const m = start + d;
      if (m >= months) return;
      shockAt.set(m, [...(shockAt.get(m) ?? []), { ev, w }]);
    });
  });

  const values: number[] = [10000];
  let pv = 10000;

  for (let m = 0; m < months; m++) {
    let monthRet = 0;
    for (const [key, pct] of Object.entries(allocation)) {
      if (!pct) continue;
      const p     = SIM_PARAMS[key as AssetClassKey] ?? { mu: 0.07, sigma: 0.15 };
      const sigma = p.sigma * concMult;
      const drift     = (p.mu - 0.5 * sigma ** 2) / 12;
      const diffusion = (sigma / Math.sqrt(12)) * randn();
      let r = Math.exp(drift + diffusion) - 1;
      for (const { ev, w } of shockAt.get(m) ?? []) {
        r += (ev.shocks[key as AssetClassKey] ?? 0) * w;
      }
      monthRet += (pct / 100) * r;
    }
    pv = Math.max(10, pv * (1 + monthRet));
    values.push(pv);
  }
  return { values, finalValue: pv, totalReturn: ((pv - 10000) / 10000) * 100 };
}

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */
function initLevels(): Record<AssetClassKey, Level> {
  const l = {} as Record<AssetClassKey, Level>;
  ASSET_CLASS_KEYS.forEach((k) => { l[k] = 2; });
  return l;
}

function levelsToWeights(levels: Record<AssetClassKey, Level>, activeKeys: AssetClassKey[]): Record<string, number> {
  if (activeKeys.length === 0) return {};
  const total = activeKeys.reduce((s, k) => s + LEVEL_UNITS[levels[k]], 0);
  const w: Record<string, number> = {};
  let acc = 0;
  activeKeys.forEach((k, i) => {
    w[k] = i === activeKeys.length - 1
      ? 100 - acc
      : Math.round((LEVEL_UNITS[levels[k]] / total) * 100);
    acc += w[k];
  });
  return w;
}

function allocationToLevels(alloc: Record<string, number>): Record<AssetClassKey, Level> {
  const res = {} as Record<AssetClassKey, Level>;
  ASSET_CLASS_KEYS.forEach((k) => {
    const pct = alloc[k] ?? 25;
    res[k] = pct >= 35 ? 3 : pct >= 18 ? 2 : 1;
  });
  return res;
}

/* ══════════════════════════════════════════════
   MINI CHART
══════════════════════════════════════════════ */
function MiniChart({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const W = 500; const H = 120;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rng = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - ((v - min) / rng) * H}`);
  const line = `M ${pts.join(" L ")}`;
  const area = `M 0,${H} L ${pts.join(" L ")} L ${W},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 120 }}>
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#cg)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

/* ══════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════ */
export default function SandboxPage() {
  const strategies       = useGameStore((s) => s.strategies);
  const addStrategy      = useGameStore((s) => s.addStrategy);
  const updateStrategy   = useGameStore((s) => s.updateStrategy);
  const deleteStrategy   = useGameStore((s) => s.deleteStrategy);
  const playerName       = useGameStore((s) => s.playerName);
  const setPlayerName    = useGameStore((s) => s.setPlayerName);
  const battleRecords    = useGameStore((s) => s.battleRecords);
  const addBattleRecord  = useGameStore((s) => s.addBattleRecord);

  const [battleTarget, setBattleTarget] = useState<Strategy | null>(null);
  const [pvpOpponent, setPvpOpponent]   = useState<string | null>(null);
  const [pvpOpponentAlloc, setPvpOpponentAlloc] = useState<Record<string, number> | null>(null);
  const [pvpSeed, setPvpSeed]           = useState<number | null>(null);
  const [nameInput, setNameInput]       = useState("");
  const [nameError, setNameError]       = useState("");
  const [nameClaiming, setNameClaiming] = useState(false);

  const handleClaimName = async () => {
    const name = nameInput.trim();
    if (!name) return;
    setNameError("");
    setNameClaiming(true);
    try {
      await claimUsername(name);
      setPlayerName(name);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      if (msg.includes("409") || msg.toLowerCase().includes("taken")) {
        setNameError("Username already taken. Try another one.");
      } else {
        setNameError("Could not claim username. Try again.");
      }
    } finally {
      setNameClaiming(false);
    }
  };

  /* Matchmaking state */
  const router = useRouter();
  const [matchmaking, setMatchmaking] = useState<Strategy | null>(null);
  const [matchStatus, setMatchStatus] = useState<"searching" | "waiting" | "not_found">("searching");
  const [matchTimer, setMatchTimer]   = useState(15);
  const [showBotOption, setShowBotOption] = useState(false);
  const matchCancelled = useRef(false);
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Presence / online players (REST polling) */
  const [worldOpen, setWorldOpen] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [battleRequest, setBattleRequest] = useState<{ from_id: string; from_username: string; from_allocation?: Record<string, number> | null } | null>(null);
  const [challengeSent, setChallengeSent] = useState<string | null>(null);

  useEffect(() => {
    if (!playerName) return;
    const playerId = playerName;
    let active = true;

    const poll = async () => {
      if (!active) return;
      try {
        // Heartbeat — also checks if we got redirected to a battle
        const hb = await presenceHeartbeat(playerId, playerName);
        if (!active) return;
        if (hb.go_to_battle) {
            // Challenge was accepted — open battle with first strategy
            const opName = onlinePlayers.find(p => p.id === challengeSent)?.username ?? "Opponent";
            const strat = strategies[0] ?? { name: "Default", allocation: { equities: 25, etfs: 25, bonds: 25, commodities: 25 } } as Strategy;
            setPvpOpponent(opName);
            if (hb.opponent_allocation) setPvpOpponentAlloc(hb.opponent_allocation);
            if (hb.seed) setPvpSeed(hb.seed);
            setBattleTarget(strat);
            setChallengeSent(null);
            return;
          }

        // Fetch online players
        const { players } = await presenceOnline();
        if (!active) return;
        console.log("[presence] online:", players.length, "players", players.map(p => p.username));
        setOnlinePlayers(players.filter((p) => p.id !== playerId));

        // Check for incoming challenges
        const { challenge } = await presenceGetChallenges(playerId);
        if (!active) return;
        if (challenge) setBattleRequest(challenge);
      } catch (err) { console.error("[presence] poll error:", err); }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => { active = false; clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerName]);

  const startMatchmaking = useCallback(async (strategy: Strategy) => {
    setMatchmaking(strategy);
    setMatchStatus("searching");
    setMatchTimer(30);
    setShowBotOption(false);
    matchCancelled.current = false;
    if (botTimerRef.current) clearTimeout(botTimerRef.current);
    botTimerRef.current = setTimeout(() => { if (!matchCancelled.current) setShowBotOption(true); }, 5000);

    const playerId = playerName;
    const start = Date.now();
    let roomId: string | null = null;

    const poll = async () => {
      if (matchCancelled.current) return;
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setMatchTimer(Math.max(0, 30 - elapsed));

      if (elapsed >= 30) {
        setMatchStatus("not_found");
        return;
      }

      try {
        if (!roomId) {
          // First call: try to join or create a room
          const result = await quickmatch(playerId, playerName, matchmaking?.allocation);
          if (matchCancelled.current) return;

          if (result.joined) {
            setPvpOpponent(result.opponent ?? "Opponent");
            if (result.opponent_allocation) setPvpOpponentAlloc(result.opponent_allocation);
            if (result.seed) setPvpSeed(result.seed);
            setBattleTarget(matchmaking);
            setMatchmaking(null);
            return;
          }

          // Created a room — now poll for opponent
          roomId = result.room_id;
          setMatchStatus("waiting");
        } else {
          // Poll: check if someone joined our room
          const data = await getBattle(roomId);
          if (matchCancelled.current) return;
          if (data.player2) {
            setPvpOpponent(data.player2);
            if (data.player2_allocation) setPvpOpponentAlloc(data.player2_allocation);
            setBattleTarget(matchmaking);
            setMatchmaking(null);
            return;
          }
        }
      } catch { /* server unreachable — keep trying */ }

      setTimeout(poll, 2000);
    };
    poll();
  }, [playerName, router]);

  function cancelMatchmaking() {
    matchCancelled.current = true;
    if (botTimerRef.current) clearTimeout(botTimerRef.current);
    setMatchmaking(null);
  }

  function fightBot() {
    const strategy = matchmaking;
    setMatchmaking(null);
    if (strategy) setBattleTarget(strategy);
  }

  /* Builder state */
  const [building, setBuilding]           = useState(false);
  const [editingIndex, setEditingIndex]   = useState<number | null>(null);
  const [step, setStep]                   = useState<BuildStep>(0);
  const [selections, setSelections]       = useState<Selections>({ equities: [], etfs: [], bonds: [], commodities: [] });
  const [levels, setLevels]               = useState<Record<AssetClassKey, Level>>(initLevels);
  const [name, setName]                   = useState("");
  const [infoOpen, setInfoOpen]           = useState(false);
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);

  /* Test state */
  const [testTarget, setTestTarget]     = useState<{ strategy: Strategy; index: number } | null>(null);
  const [testStep, setTestStep]         = useState<TestStep>("horizon");
  const [horizon, setHorizon]           = useState(10);
  const [pickedEvents, setPickedEvents] = useState<string[]>([]);
  const [eventTimings, setEventTimings] = useState<Record<string, number>>({});
  const [simResult, setSimResult]       = useState<ReturnType<typeof runSim> | null>(null);
  const [coachText, setCoachText]       = useState<string | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);

  /* ─── Builder helpers ─── */
  function openBuilder(editIdx?: number) {
    if (editIdx !== null && editIdx !== undefined) {
      const s = strategies[editIdx];
      setName(s.name);
      setLevels(allocationToLevels(s.allocation));
      const sel: Selections = { equities: [], etfs: [], bonds: [], commodities: [] };
      if (s.selectedAssets) Object.assign(sel, s.selectedAssets);
      setSelections(sel);
      setEditingIndex(editIdx);
    } else {
      setName("");
      setLevels(initLevels());
      setSelections({ equities: [], etfs: [], bonds: [], commodities: [] });
      setEditingIndex(null);
    }
    setStep(0); setInfoOpen(false); setExpandedAsset(null); setBuilding(true);
  }

  function toggleAsset(classKey: AssetClassKey, id: string) {
    setSelections((prev) => ({
      ...prev,
      [classKey]: prev[classKey].includes(id)
        ? prev[classKey].filter((x) => x !== id)
        : [...prev[classKey], id],
    }));
  }

  function nextStep() { if (step < 4) { setStep((s) => (s + 1) as BuildStep); setInfoOpen(false); setExpandedAsset(null); } }
  function prevStep() { if (step > 0) { setStep((s) => (s - 1) as BuildStep); setInfoOpen(false); setExpandedAsset(null); } }

  function deploy() {
    const ak = ASSET_CLASS_KEYS.filter((k) => selections[k].length > 0);
    const allocation = levelsToWeights(levels, ak);
    const strat: Strategy = {
      name: name.trim() || `Strategy ${strategies.length + 1}`,
      allocation, selectedAssets: selections, scenario_key: "sandbox",
    };
    if (editingIndex !== null) updateStrategy(editingIndex, strat);
    else addStrategy(strat);
    setBuilding(false);
  }

  /* ─── Test helpers ─── */
  function openTest(strategy: Strategy, index: number) {
    setTestTarget({ strategy, index });
    setTestStep("horizon"); setHorizon(10);
    setPickedEvents([]); setEventTimings({}); setSimResult(null);
    setCoachText(null); setCoachLoading(false);
  }

  async function runTest() {
    if (!testTarget) return;
    const events = pickedEvents.map((key) => ({
      event: GAME_EVENTS.find((e) => e.key === key)!,
      atYear: eventTimings[key] ?? horizon / 2,
    }));
    const result = runSim(testTarget.strategy.allocation, horizon, events, Math.random() * 2 ** 32 | 0);
    setSimResult(result);
    setCoachText(null);
    setTestStep("results");

    // Build prompt for coach
    const alloc    = testTarget.strategy.allocation;
    const allocStr = Object.entries(alloc)
      .sort(([, a], [, b]) => b - a)
      .map(([k, v]) => `${ASSET_CLASSES[k as AssetClassKey]?.label ?? k} ${v}%`)
      .join(", ");
    const eventsStr = pickedEvents.length === 0
      ? "no market events"
      : pickedEvents.map((key) => {
          const ev = GAME_EVENTS.find((e) => e.key === key)!;
          return `${ev.label} at year ${eventTimings[key] ?? Math.round(horizon / 2)}`;
        }).join(", ");
    const returnStr  = result.totalReturn >= 0 ? `+${result.totalReturn.toFixed(1)}%` : `${result.totalReturn.toFixed(1)}%`;
    const maxAlloc   = Math.max(...Object.values(alloc));
    const negCount   = pickedEvents.filter((k) => GAME_EVENTS.find((e) => e.key === k)?.type === "negative").length;
    const riskLabel  = maxAlloc >= 80 ? "DANGEROUSLY concentrated (no diversification)" : maxAlloc >= 60 ? "highly concentrated" : "moderately diversified";
    const harshNote  = result.totalReturn < -15 || (negCount >= 2 && maxAlloc >= 70)
      ? "This was a poor, high-risk strategy. Be direct and critical — do NOT call it good or say it performed reasonably. Point out the lack of diversification and vulnerability to bad events."
      : result.totalReturn < 0
      ? "This strategy underperformed. Be honest about why."
      : "";

    const prompt = `You are a blunt, experienced investment coach giving honest feedback to a beginner investor. Do NOT sugarcoat bad strategies.

Strategy: "${testTarget.strategy.name}"
Allocation: ${allocStr}
Risk profile: ${riskLabel}
Time horizon: ${horizon} years
Market events: ${eventsStr}
Result: ${returnStr} total return (final value $${result.finalValue.toFixed(0)} from $10,000 start)
${harshNote}

Give feedback in exactly two parts — no headers, no bullet points, plain text only:
1. One sentence (max 25 words) honest assessment of the strategy. If undiversified or risky, use words like "dangerously concentrated", "no safety net", "extremely vulnerable", or "no buffer against losses".
2. Two to three sentences explaining why the portfolio performed this way given the specific events and allocation. Keep it simple enough for a beginner.`;

    setCoachLoading(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setCoachText(data.text ?? null);
    } catch {
      setCoachText(null);
    } finally {
      setCoachLoading(false);
    }
  }

  function toggleEvent(key: string) {
    setPickedEvents((prev) => {
      if (prev.includes(key)) {
        setEventTimings((t) => { const n = { ...t }; delete n[key]; return n; });
        return prev.filter((k) => k !== key);
      }
      setEventTimings((t) => ({ ...t, [key]: Math.round(horizon / 2) }));
      return [...prev, key];
    });
  }

  function setEventYear(key: string, year: number) {
    setEventTimings((t) => ({ ...t, [key]: year }));
  }

  const currentKey = step < 4 ? ASSET_CLASS_KEYS[step] : null;
  const currentCls = currentKey ? ASSET_CLASSES[currentKey] : null;
  const activeKeys = ASSET_CLASS_KEYS.filter((k) => selections[k].length > 0);
  const weights    = levelsToWeights(levels, activeKeys);

  return (
    <div
      className="min-h-screen px-5 py-8 md:px-10"
      style={{
        backgroundImage: "linear-gradient(rgba(0,212,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.025) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }}
    >
      {/* ── Name modal (blocks UI until name is set) ── */}
      <AnimatePresence>
        {!playerName && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: "rgba(6,6,14,0.97)", backgroundImage: "linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)", backgroundSize: "48px 48px" }}>
            <motion.div className="w-full max-w-sm md:max-w-md px-8 py-12 md:px-10 md:py-14 rounded-2xl border border-[#00d4ff]/25 bg-white/[0.02]"
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}>
              <p className="mb-1 font-mono text-[10px] md:text-xs uppercase tracking-[0.3em] text-[#00d4ff]/60">◈ CACHE ME IF YOU CAN</p>
              <p className="mb-2 font-mono text-2xl md:text-3xl font-bold text-white">ENTER YOUR<br />CALLSIGN</p>
              <p className="mb-8 text-xs md:text-sm text-white/40">Choose a unique name — it will appear on the leaderboard.</p>
              <input
                type="text" maxLength={20} placeholder="e.g. WallStreetWolf"
                value={nameInput} onChange={e => { setNameInput(e.target.value); setNameError(""); }}
                onKeyDown={e => e.key === "Enter" && nameInput.trim() && handleClaimName()}
                className={`mb-2 w-full rounded-xl border bg-white/[0.03] px-4 py-3 md:px-5 md:py-4 font-mono text-sm md:text-base text-white placeholder-white/20 outline-none transition-all ${nameError ? "border-[#ff453a]/60" : "border-[#00d4ff]/25 focus:border-[#00d4ff]/60"}`} />
              {nameError && <p className="mb-2 font-mono text-xs text-[#ff453a]">{nameError}</p>}
              {!nameError && <div className="mb-2" />}
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                disabled={!nameInput.trim() || nameClaiming}
                onClick={handleClaimName}
                className="w-full rounded-xl border border-[#00d4ff]/40 bg-[#00d4ff]/10 py-3 md:py-4 font-mono text-sm md:text-base font-bold uppercase tracking-widest text-[#00d4ff] transition-all hover:bg-[#00d4ff]/20 disabled:opacity-30 disabled:cursor-not-allowed">
                {nameClaiming ? "CLAIMING..." : "ENTER ARENA →"}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Matchmaking overlay ── */}
      <AnimatePresence>
        {matchmaking && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: "rgba(6,6,14,0.97)", backgroundImage: "linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)", backgroundSize: "48px 48px" }}>
            <motion.div className="w-full max-w-sm md:max-w-md px-8 py-12 text-center"
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}>

              {matchStatus !== "not_found" && (
                <>
                  <div className="mx-auto mb-6 h-10 w-10 md:h-12 md:w-12 animate-spin rounded-full border-2 border-[#ff9f0a] border-t-transparent" />
                  <p className="mb-2 font-mono text-xl md:text-2xl font-bold text-white">
                    {matchStatus === "searching" ? "SEARCHING..." : "WAITING FOR OPPONENT"}
                  </p>
                  <p className="mb-1 font-mono text-sm md:text-base text-white/40">
                    {matchStatus === "searching" ? "Looking for open rooms" : `Time remaining: ${matchTimer}s`}
                  </p>
                  <p className="mb-8 font-mono text-xs md:text-sm text-white/25">
                    Strategy: {matchmaking.name}
                  </p>
                </>
              )}

              {matchStatus === "not_found" && (
                <>
                  <div className="mx-auto mb-6 font-mono text-4xl md:text-5xl text-white/20">⚔</div>
                  <p className="mb-2 font-mono text-xl md:text-2xl font-bold text-white">NO PLAYERS FOUND</p>
                  <p className="mb-8 font-mono text-sm md:text-base text-white/40">
                    No opponents available right now. Fight the A.I. instead?
                  </p>
                </>
              )}

              <AnimatePresence>
                {showBotOption && (
                  <motion.button
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={fightBot}
                    className="mb-3 w-full rounded-xl border border-[#ff9f0a]/40 bg-[#ff9f0a]/10 py-3.5 md:py-4 font-mono text-sm md:text-base font-bold uppercase tracking-widest text-[#ff9f0a] transition-all hover:bg-[#ff9f0a]/20">
                    ⚔ FIGHT A.I. BOT
                  </motion.button>
                )}
              </AnimatePresence>

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={cancelMatchmaking}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 md:py-3.5 font-mono text-sm md:text-base font-bold uppercase tracking-widest text-white/40 transition-all hover:bg-white/[0.06]">
                CANCEL
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Incoming battle request ── */}
      <AnimatePresence>
        {battleRequest && (
          <motion.div className="fixed bottom-6 right-6 z-50" initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}>
            <div className="rounded-xl border border-[#ff9f0a]/40 bg-[#0a0a14]/95 px-5 py-4 shadow-2xl backdrop-blur-sm" style={{ minWidth: 260 }}>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-[#ff9f0a]/60">INCOMING CHALLENGE</p>
              <p className="mb-3 font-mono text-sm font-bold text-white">
                <span className="text-[#ff9f0a]">{battleRequest.from_username}</span> wants to battle!
              </p>
              <div className="flex gap-2">
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={async () => {
                    const pid = playerName;
                    const strat = strategies[0] ?? { name: "Default", allocation: { equities: 25, etfs: 25, bonds: 25, commodities: 25 } } as Strategy;
                    try {
                      const resp = await presenceAccept(pid, battleRequest.from_id, strat.allocation);
                      if (resp.opponent_allocation) setPvpOpponentAlloc(resp.opponent_allocation);
                      if (resp.seed) setPvpSeed(resp.seed);
                    } catch {}
                    setPvpOpponent(battleRequest.from_username);
                    setBattleTarget(strat);
                    setBattleRequest(null);
                  }}
                  className="flex-1 rounded-lg bg-[#30d158] py-2 font-mono text-xs font-bold uppercase text-black transition-all hover:bg-[#3bde63]">
                  ACCEPT
                </motion.button>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    const pid = playerName;
                    presenceDecline(pid, battleRequest.from_id).catch(() => {});
                    setBattleRequest(null);
                  }}
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] py-2 font-mono text-xs font-bold uppercase text-white/50 transition-all hover:bg-white/[0.08]">
                  DECLINE
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Battle arena overlay ── */}
      <AnimatePresence>
        {battleTarget && (
          <BattleArena
            strategy={battleTarget}
            playerName={playerName}
            onClose={() => { setBattleTarget(null); setPvpOpponent(null); setPvpOpponentAlloc(null); setPvpSeed(null); }}
            onResult={(won, returnPct, cpuReturnPct) => {
              addBattleRecord({
                playerName,
                strategyName: battleTarget.name,
                returnPct,
                cpuReturnPct,
                won,
                date: new Date().toLocaleDateString(),
              });
            }}
            opponentName={pvpOpponent ?? undefined}
            opponentAllocation={pvpOpponentAlloc ?? undefined}
            seed={pvpSeed ?? undefined}
            onPlayAgain={() => { setBattleTarget(null); setPvpOpponent(null); setPvpOpponentAlloc(null); setPvpSeed(null); }}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <div className="h-px flex-1 bg-[#00d4ff]/20" />
        <h1 className="font-mono text-xs md:text-sm font-bold uppercase tracking-[0.3em] text-[#00d4ff]">◈ SANDBOX</h1>
        <div className="h-px flex-1 bg-[#00d4ff]/20" />
      </div>

      {/* List header */}
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-[10px] md:text-xs font-bold uppercase tracking-[0.25em] text-white/50">MY STRATEGIES</span>
        <div className="flex items-center gap-2">
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setWorldOpen(!worldOpen)}
            className="flex items-center gap-2 rounded-lg border border-[#30d158]/40 bg-[#30d158]/10 px-4 py-2 md:px-5 md:py-2.5 font-mono text-xs md:text-sm font-semibold uppercase tracking-widest text-[#30d158] transition-all hover:bg-[#30d158]/20">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#30d158] opacity-75" /><span className="inline-flex h-2 w-2 rounded-full bg-[#30d158]" /></span>
            WORLD{onlinePlayers.length > 0 && ` (${onlinePlayers.length})`}
          </motion.button>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => openBuilder()}
            className="flex items-center gap-2 rounded-lg border border-[#00d4ff]/40 bg-[#00d4ff]/10 px-4 py-2 md:px-5 md:py-2.5 font-mono text-xs md:text-sm font-semibold uppercase tracking-widest text-[#00d4ff] transition-all hover:bg-[#00d4ff]/20">
            <span className="text-base leading-none">+</span> NEW STRATEGY
          </motion.button>
        </div>
      </div>

      {/* Online players panel */}
      <AnimatePresence>
        {worldOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="mb-6 overflow-hidden rounded-xl border border-[#30d158]/20 bg-[#30d158]/[0.03]">
            <div className="px-5 py-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="font-mono text-[10px] md:text-xs font-bold uppercase tracking-[0.25em] text-[#30d158]">ONLINE PLAYERS</span>
                <div className="h-px flex-1 bg-[#30d158]/15" />
              </div>
              {onlinePlayers.length === 0 ? (
                <p className="py-4 text-center font-mono text-xs text-white/30">No other players online right now</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {onlinePlayers.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className={`h-2 w-2 rounded-full ${p.in_battle ? "bg-[#ff9f0a]" : "bg-[#30d158]"}`} />
                        <span className="font-mono text-xs md:text-sm font-semibold text-white">{p.username}</span>
                        {p.in_battle && <span className="font-mono text-[9px] uppercase text-[#ff9f0a]/60">in battle</span>}
                      </div>
                      {!p.in_battle && (
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                          disabled={challengeSent === p.id}
                          onClick={() => {
                            const pid = playerName;
                            const alloc = strategies[0]?.allocation ?? { equities: 25, etfs: 25, bonds: 25, commodities: 25 };
                            presenceChallenge(pid, p.id, alloc).catch(() => {});
                            setChallengeSent(p.id);
                          }}
                          className="rounded-md border border-[#ff9f0a]/40 bg-[#ff9f0a]/10 px-3 py-1 font-mono text-[10px] md:text-xs font-bold uppercase text-[#ff9f0a] transition-all hover:bg-[#ff9f0a]/20 disabled:opacity-40">
                          {challengeSent === p.id ? "SENT" : "CHALLENGE"}
                        </motion.button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Strategy grid */}
      {strategies.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] py-20 text-center">
          <div className="mb-4 font-mono text-4xl text-[#00d4ff]/20">◈</div>
          <p className="mb-1 font-mono text-sm md:text-base font-bold uppercase tracking-widest text-white/50">NO STRATEGIES YET</p>
          <p className="mb-6 text-xs md:text-sm text-white/40">Build your first portfolio strategy to get started</p>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => openBuilder()}
            className="rounded-lg border border-[#00d4ff]/40 bg-[#00d4ff]/10 px-6 py-2.5 md:px-8 md:py-3 font-mono text-xs md:text-sm font-bold uppercase tracking-widest text-[#00d4ff] transition-all hover:bg-[#00d4ff]/20">
            + DEPLOY FIRST STRATEGY
          </motion.button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {strategies.map((s, i) => (
            <StrategyCard key={i} strategy={s}
              onDelete={() => deleteStrategy(i)}
              onEdit={() => openBuilder(i)}
              onTest={() => openTest(s, i)}
              onBattle={() => startMatchmaking(s)}
            />
          ))}
        </div>
      )}

      {/* ── Leaderboard ── */}
      {battleRecords.length > 0 && (
        <div className="mt-12">
          <div className="mb-4 flex items-center gap-4">
            <div className="h-px flex-1 bg-[#ff9f0a]/20" />
            <span className="font-mono text-[10px] md:text-xs font-bold uppercase tracking-[0.3em] text-[#ff9f0a]">⚔ BATTLE RECORDS</span>
            <div className="h-px flex-1 bg-[#ff9f0a]/20" />
          </div>
          <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  {["#", "PLAYER", "STRATEGY", "RETURN", "A.I.", "RESULT", "DATE"].map(h => (
                    <th key={h} className="px-4 py-2.5 md:py-3 text-left font-mono text-[9px] md:text-xs uppercase tracking-widest text-white/35">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {battleRecords.map((r, i) => (
                  <tr key={i} className="border-b border-white/[0.03] transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-3 md:py-3.5 font-mono text-[10px] md:text-xs text-white/30">{i + 1}</td>
                    <td className="px-4 py-3 md:py-3.5 font-mono text-xs md:text-sm font-bold text-white">{r.playerName}</td>
                    <td className="px-4 py-3 md:py-3.5 font-mono text-[10px] md:text-xs text-white/55">{r.strategyName}</td>
                    <td className="px-4 py-3 md:py-3.5 font-mono text-xs md:text-sm font-bold tabular-nums" style={{ color: r.returnPct >= 0 ? "#30d158" : "#ff453a" }}>
                      {r.returnPct >= 0 ? "+" : ""}{r.returnPct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 md:py-3.5 font-mono text-xs md:text-sm tabular-nums text-white/45">
                      {r.cpuReturnPct >= 0 ? "+" : ""}{r.cpuReturnPct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 md:py-3.5">
                      <span className="rounded-full px-2.5 py-1 md:px-3 md:py-1.5 font-mono text-[9px] md:text-xs font-bold uppercase tracking-widest"
                        style={{ background: r.won ? "rgba(48,209,88,0.12)" : "rgba(255,69,58,0.12)", color: r.won ? "#30d158" : "#ff453a" }}>
                        {r.won ? "WIN" : "LOSS"}
                      </span>
                    </td>
                    <td className="px-4 py-3 md:py-3.5 font-mono text-[9px] md:text-xs text-white/30">{r.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ BUILDER OVERLAY ══ */}
      <AnimatePresence>
        {building && (
          <motion.div key="builder" className="fixed inset-0 z-50 flex flex-col"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: "rgba(0,0,0,0.97)", backgroundImage: "linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)", backgroundSize: "48px 48px" }}>

            {/* Builder header */}
            <div className="flex items-center justify-between border-b border-[#00d4ff]/20 px-6 py-4 md:px-8 md:py-5">
              <div className="flex items-center gap-4">
                <button onClick={step > 0 ? prevStep : () => setBuilding(false)}
                  className="font-mono text-xs md:text-sm font-semibold text-[#00d4ff]/70 transition-colors hover:text-[#00d4ff]">
                  {step > 0 ? "← BACK" : "← CANCEL"}
                </button>
                {currentCls && (
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xl md:text-2xl" style={{ color: currentCls.color }}>{currentCls.icon}</span>
                    <span className="font-mono text-sm md:text-base font-bold uppercase tracking-widest text-white">{currentCls.label}</span>
                    <button onClick={() => setInfoOpen((v) => !v)}
                      className="flex h-5 w-5 items-center justify-center rounded-full border font-mono text-[11px] font-bold transition-all"
                      style={{ borderColor: infoOpen ? currentCls.color : "rgba(255,255,255,0.15)", color: infoOpen ? currentCls.color : "rgba(255,255,255,0.3)", background: infoOpen ? `${currentCls.color}15` : "transparent" }}>
                      i
                    </button>
                  </div>
                )}
                {step === 4 && <span className="font-mono text-sm md:text-base font-bold uppercase tracking-widest text-white">ALLOCATE WEIGHTS</span>}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  {([0,1,2,3,4] as BuildStep[]).map((s) => (
                    <div key={s} className="h-1.5 rounded-full transition-all"
                      style={{ width: s === step ? "20px" : "6px", background: s === step ? (currentCls?.color ?? "#00d4ff") : s < step ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)" }} />
                  ))}
                </div>
                <span className="font-mono text-[10px] md:text-xs text-white/45 uppercase tracking-widest">{String(step + 1).padStart(2, "0")} / 05</span>
                <button onClick={() => setBuilding(false)} className="font-mono text-lg leading-none text-white/55 transition-colors hover:text-white/80">×</button>
              </div>
            </div>

            {/* Builder body */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <AnimatePresence mode="wait">

                {/* Asset class steps 0-3 */}
                {step < 4 && currentKey && currentCls && (
                  <motion.div key={`step-${step}`} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }}>
                    <AnimatePresence>
                      {infoOpen && (
                        <motion.div key="info" initial={{ height: 0, opacity: 0, marginBottom: 0 }} animate={{ height: "auto", opacity: 1, marginBottom: 24 }} exit={{ height: 0, opacity: 0, marginBottom: 0 }} className="overflow-hidden">
                          <div className="rounded-xl border p-4 text-sm leading-relaxed text-white/60" style={{ borderColor: `${currentCls.color}40`, background: `${currentCls.color}08` }}>
                            <span className="mr-2 font-mono font-bold" style={{ color: currentCls.color }}>{currentCls.icon} {currentCls.label}</span>
                            {currentCls.info}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <p className="mb-4 font-mono text-[10px] md:text-xs uppercase tracking-widest text-white/50">SELECT 0 – 5 · {selections[currentKey].length} CHOSEN</p>

                    <div className="mx-auto max-w-xl space-y-2">
                      {currentCls.examples.map((ex) => {
                        const isOn = selections[currentKey].includes(ex.id);
                        const isExp = expandedAsset === ex.id;
                        return (
                          <div key={ex.id} className="overflow-hidden rounded-xl border transition-all"
                            style={{ borderColor: isOn ? currentCls.color : "rgba(255,255,255,0.07)", background: isOn ? `${currentCls.color}10` : "rgba(255,255,255,0.02)" }}>
                            <div className="flex items-center gap-3 px-4 py-3.5 md:px-5 md:py-4">
                              <button onClick={() => toggleAsset(currentKey, ex.id)}
                                className="flex h-6 w-6 md:h-7 md:w-7 flex-shrink-0 items-center justify-center rounded border text-xs font-bold transition-all"
                                style={{ borderColor: isOn ? currentCls.color : "rgba(255,255,255,0.15)", background: isOn ? currentCls.color : "transparent", color: "#000" }}>
                                {isOn ? "✓" : ""}
                              </button>
                              <button onClick={() => toggleAsset(currentKey, ex.id)} className="flex flex-1 items-baseline gap-3 text-left">
                                <span className="font-mono text-sm md:text-base font-semibold text-white">{ex.label}</span>
                                <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest" style={{ color: `${currentCls.color}70` }}>{ex.ticker}</span>
                              </button>
                              <button onClick={() => setExpandedAsset(isExp ? null : ex.id)}
                                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-bold transition-all"
                                style={{ borderColor: isExp ? currentCls.color : "rgba(255,255,255,0.12)", color: isExp ? currentCls.color : "rgba(255,255,255,0.3)", background: isExp ? `${currentCls.color}15` : "transparent" }}>
                                i
                              </button>
                            </div>
                            <AnimatePresence>
                              {isExp && (
                                <motion.div key="xinfo" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                                  <div className="border-t px-4 py-3 text-xs leading-relaxed text-white/50" style={{ borderColor: `${currentCls.color}25` }}>{ex.info}</div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Weight step */}
                {step === 4 && (
                  <motion.div key="weights" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }} className="mx-auto max-w-xl">
                    {activeKeys.length === 0 ? (
                      <div className="flex flex-col items-center py-16 text-center">
                        <p className="mb-2 font-mono text-sm md:text-base font-bold uppercase tracking-widest text-white/50">NO ASSETS SELECTED</p>
                        <p className="text-xs md:text-sm text-white/40">Go back and select at least one asset to continue.</p>
                      </div>
                    ) : (
                    <>
                    <p className="mb-6 font-mono text-[10px] md:text-xs uppercase tracking-widest text-white/50">HOW MUCH WEIGHT ON EACH CLASS?</p>
                    <div className="space-y-3">
                      {activeKeys.map((key) => {
                        const cls = ASSET_CLASSES[key];
                        const lvl = levels[key];
                        const w   = weights[key] ?? 0;
                        return (
                          <div key={key} className="rounded-xl border border-white/[0.06] p-4" style={{ background: `${cls.color}08` }}>
                            <div className="mb-3 flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm md:text-base" style={{ color: cls.color }}>{cls.icon}</span>
                                  <span className="font-mono text-xs md:text-sm font-bold uppercase tracking-widest" style={{ color: cls.color }}>{cls.label}</span>
                                </div>
                                {selections[key].length > 0 && (
                                  <p className="mt-0.5 font-mono text-[9px] md:text-[11px] uppercase tracking-widest text-white/45">
                                    {selections[key].map((id) => cls.examples.find((e) => e.id === id)?.ticker ?? id).join(" · ")}
                                  </p>
                                )}
                              </div>
                              <motion.span key={w} initial={{ scale: 1.2, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }}
                                className="font-mono text-2xl font-bold tabular-nums" style={{ color: cls.color }}>
                                {w}%
                              </motion.span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {([1, 2, 3] as Level[]).map((l) => {
                                const active = lvl === l;
                                return (
                                  <motion.button key={l} whileTap={{ scale: 0.95 }}
                                    onClick={() => setLevels((prev) => ({ ...prev, [key]: l }))}
                                    className="rounded-lg border py-2.5 md:py-3 font-mono text-xs md:text-sm font-bold uppercase tracking-widest transition-all"
                                    style={{ borderColor: active ? cls.color : "rgba(255,255,255,0.08)", background: active ? `${cls.color}20` : "transparent", color: active ? cls.color : "rgba(255,255,255,0.25)" }}>
                                    {LEVEL_LABELS[l]}
                                  </motion.button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Strategy name input */}
                    <input type="text" placeholder={`Strategy ${strategies.length + 1}`} value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-5 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 font-mono text-sm text-white placeholder-white/20 outline-none transition-all focus:border-[#00d4ff]/40" />
                    </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Builder footer */}
            <div className="border-t border-[#00d4ff]/20 px-6 py-4 md:px-8 md:py-5">
              {step < 4 ? (
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={nextStep}
                  className="w-full rounded-xl border border-[#00d4ff]/40 bg-[#00d4ff]/10 py-3.5 md:py-4 font-mono text-sm md:text-base font-bold uppercase tracking-widest text-[#00d4ff] transition-all hover:bg-[#00d4ff]/20">
                  {currentKey && selections[currentKey].length > 0 ? `NEXT → (${selections[currentKey].length} SELECTED)` : "SKIP →"}
                </motion.button>
              ) : (
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={deploy}
                  className="w-full rounded-xl border border-[#30d158]/50 bg-[#30d158]/10 py-3.5 md:py-4 font-mono text-sm md:text-base font-bold uppercase tracking-widest text-[#30d158] transition-all hover:bg-[#30d158]/20">
                  {editingIndex !== null ? "✓ SAVE CHANGES" : "⚡ DEPLOY STRATEGY"}
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ TEST OVERLAY ══ */}
      <AnimatePresence>
        {testTarget && (
          <motion.div key="test" className="fixed inset-0 z-50 flex flex-col"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: "rgba(0,0,0,0.97)", backgroundImage: "linear-gradient(rgba(48,209,88,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(48,209,88,0.02) 1px, transparent 1px)", backgroundSize: "48px 48px" }}>

            {/* Test header */}
            <div className="flex items-center justify-between border-b border-[#30d158]/20 px-6 py-4 md:px-8 md:py-5">
              <div className="flex items-center gap-4">
                {testStep !== "horizon" && (
                  <button onClick={() => setTestStep(testStep === "results" ? "events" : "horizon")}
                    className="font-mono text-xs md:text-sm text-[#30d158]/50 transition-colors hover:text-[#30d158]">← BACK</button>
                )}
                <span className="font-mono text-sm md:text-base font-bold uppercase tracking-widest text-white">
                  {testStep === "horizon" ? "TIME HORIZON" : testStep === "events" ? "MARKET EVENTS" : "SIMULATION RESULTS"}
                </span>
                <span className="font-mono text-[10px] md:text-xs text-white/45 uppercase tracking-widest">
                  {testTarget.strategy.name}
                </span>
              </div>
              <button onClick={() => setTestTarget(null)} className="font-mono text-lg leading-none text-white/55 transition-colors hover:text-white/80">×</button>
            </div>

            {/* Test body */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <AnimatePresence mode="wait">

                {/* Step 1: Horizon */}
                {testStep === "horizon" && (
                  <motion.div key="horizon" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }} className="mx-auto max-w-sm">
                    <p className="mb-6 font-mono text-[10px] md:text-xs uppercase tracking-widest text-white/50">HOW LONG DO YOU WANT TO TEST?</p>
                    <div className="grid grid-cols-5 gap-3">
                      {HORIZONS.map((y) => (
                        <motion.button key={y} whileTap={{ scale: 0.95 }}
                          onClick={() => setHorizon(y)}
                          className="rounded-xl border py-5 md:py-6 font-mono text-sm md:text-base font-bold transition-all"
                          style={{
                            borderColor: horizon === y ? "#30d158" : "rgba(255,255,255,0.08)",
                            background:  horizon === y ? "rgba(48,209,88,0.12)" : "rgba(255,255,255,0.02)",
                            color:       horizon === y ? "#30d158" : "rgba(255,255,255,0.3)",
                          }}>
                          {y}Y
                        </motion.button>
                      ))}
                    </div>
                    <p className="mt-6 text-center text-xs md:text-sm text-white/40">
                      Simulation runs {horizon * 12} monthly steps using GBM with your allocation
                    </p>
                  </motion.div>
                )}

                {/* Step 2: Events */}
                {testStep === "events" && (
                  <motion.div key="events" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }} className="mx-auto max-w-xl">
                    <p className="mb-5 font-mono text-[10px] md:text-xs uppercase tracking-widest text-white/50">
                      SELECT ANY EVENTS AND SET WHEN THEY HAPPEN · {pickedEvents.length} SELECTED
                    </p>

                    {/* Positive group */}
                    <div className="mb-3 flex items-center gap-2">
                      <div className="h-1.5 w-1.5 md:h-2 md:w-2 rounded-full bg-[#30d158]" />
                      <span className="font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#30d158]">POSITIVE EVENTS</span>
                    </div>
                    <div className="mb-5 space-y-2">
                      {POS_EVENTS.map((ev) => {
                        const on = pickedEvents.includes(ev.key);
                        const yr = eventTimings[ev.key] ?? Math.round(horizon / 2);
                        return (
                          <div key={ev.key} className="overflow-hidden rounded-xl border transition-all"
                            style={{ borderColor: on ? "#30d158" : "rgba(255,255,255,0.07)", background: on ? "rgba(48,209,88,0.06)" : "rgba(255,255,255,0.02)" }}>
                            <button onClick={() => toggleEvent(ev.key)} className="flex w-full items-start gap-3 p-3.5 text-left">
                              <div className="mt-0.5 flex h-5 w-5 md:h-6 md:w-6 flex-shrink-0 items-center justify-center rounded border text-[10px] font-bold transition-all"
                                style={{ borderColor: on ? "#30d158" : "rgba(255,255,255,0.15)", background: on ? "#30d158" : "transparent", color: "#000" }}>
                                {on ? "✓" : ""}
                              </div>
                              <div>
                                <p className="font-mono text-xs md:text-sm font-bold" style={{ color: on ? "#30d158" : "rgba(255,255,255,0.7)" }}>{ev.label}</p>
                                <p className="mt-0.5 text-[11px] md:text-xs leading-snug text-white/55">{ev.description}</p>
                              </div>
                            </button>
                            <AnimatePresence>
                              {on && (
                                <motion.div key="timing" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                                  <div className="flex items-center gap-4 border-t border-[#30d158]/20 px-4 py-3">
                                    <span className="font-mono text-[10px] uppercase tracking-widest text-white/55 flex-shrink-0">YEAR</span>
                                    <input type="range" min={1} max={horizon} step={1} value={yr}
                                      onChange={(e) => setEventYear(ev.key, parseInt(e.target.value))}
                                      className="flex-1 cursor-pointer" style={{ accentColor: "#30d158" }} />
                                    <span className="font-mono text-sm font-bold tabular-nums text-[#30d158] w-6 text-right">{yr}</span>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>

                    {/* Negative group */}
                    <div className="mb-3 flex items-center gap-2">
                      <div className="h-1.5 w-1.5 md:h-2 md:w-2 rounded-full bg-[#ff453a]" />
                      <span className="font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#ff453a]">NEGATIVE EVENTS</span>
                    </div>
                    <div className="space-y-2">
                      {NEG_EVENTS.map((ev) => {
                        const on = pickedEvents.includes(ev.key);
                        const yr = eventTimings[ev.key] ?? Math.round(horizon / 2);
                        return (
                          <div key={ev.key} className="overflow-hidden rounded-xl border transition-all"
                            style={{ borderColor: on ? "#ff453a" : "rgba(255,255,255,0.07)", background: on ? "rgba(255,69,58,0.06)" : "rgba(255,255,255,0.02)" }}>
                            <button onClick={() => toggleEvent(ev.key)} className="flex w-full items-start gap-3 p-3.5 text-left">
                              <div className="mt-0.5 flex h-5 w-5 md:h-6 md:w-6 flex-shrink-0 items-center justify-center rounded border text-[10px] font-bold transition-all"
                                style={{ borderColor: on ? "#ff453a" : "rgba(255,255,255,0.15)", background: on ? "#ff453a" : "transparent", color: "#000" }}>
                                {on ? "✓" : ""}
                              </div>
                              <div>
                                <p className="font-mono text-xs md:text-sm font-bold" style={{ color: on ? "#ff453a" : "rgba(255,255,255,0.7)" }}>{ev.label}</p>
                                <p className="mt-0.5 text-[11px] md:text-xs leading-snug text-white/55">{ev.description}</p>
                              </div>
                            </button>
                            <AnimatePresence>
                              {on && (
                                <motion.div key="timing" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                                  <div className="flex items-center gap-4 border-t border-[#ff453a]/20 px-4 py-3">
                                    <span className="font-mono text-[10px] uppercase tracking-widest text-white/55 flex-shrink-0">YEAR</span>
                                    <input type="range" min={1} max={horizon} step={1} value={yr}
                                      onChange={(e) => setEventYear(ev.key, parseInt(e.target.value))}
                                      className="flex-1 cursor-pointer" style={{ accentColor: "#ff453a" }} />
                                    <span className="font-mono text-sm font-bold tabular-nums text-[#ff453a] w-6 text-right">{yr}</span>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Results */}
                {testStep === "results" && simResult && (
                  <motion.div key="results" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }} className="mx-auto max-w-2xl">
                    <p className="mb-6 font-mono text-[10px] md:text-xs uppercase tracking-widest text-white/50">
                      {horizon}Y SIMULATION · {testTarget.strategy.name}
                    </p>

                    {/* Metrics */}
                    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <Metric label="FINAL VALUE"   value={`$${simResult.finalValue.toFixed(0)}`} color={simResult.totalReturn >= 0 ? "#30d158" : "#ff453a"} />
                      <Metric label="TOTAL RETURN"  value={`${simResult.totalReturn >= 0 ? "+" : ""}${simResult.totalReturn.toFixed(1)}%`} color={simResult.totalReturn >= 0 ? "#30d158" : "#ff453a"} />
                      <Metric label="START VALUE"   value="$10,000" color="rgba(255,255,255,0.4)" />
                    </div>

                    {/* Chart */}
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <MiniChart values={simResult.values} color={simResult.totalReturn >= 0 ? "#30d158" : "#ff453a"} />
                    </div>

                    {/* Events fired */}
                    {pickedEvents.length > 0 && (
                      <div className="mt-5 rounded-xl border border-white/[0.06] p-4">
                        <p className="mb-3 font-mono text-[10px] md:text-xs uppercase tracking-widest text-white/50">EVENTS INJECTED</p>
                        <div className="flex flex-wrap gap-2">
                          {pickedEvents.map((key) => {
                            const ev  = GAME_EVENTS.find((e) => e.key === key)!;
                            const pos = ev.type === "positive";
                            const yr  = eventTimings[key] ?? Math.round(horizon / 2);
                            return (
                              <span key={key} className="rounded-full border px-3 py-1 md:px-4 md:py-1.5 font-mono text-[10px] md:text-xs font-bold uppercase tracking-wide"
                                style={{ borderColor: pos ? "rgba(48,209,88,0.4)" : "rgba(255,69,58,0.4)", color: pos ? "#30d158" : "#ff453a", background: pos ? "rgba(48,209,88,0.06)" : "rgba(255,69,58,0.06)" }}>
                                {ev.label} · Y{yr}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Coach feedback */}
                    <div className="mt-5 rounded-xl border border-[#00d4ff]/20 bg-[#00d4ff]/04 p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="font-mono text-sm text-[#00d4ff]">◈</span>
                        <span className="font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#00d4ff]">COACH FEEDBACK</span>
                      </div>
                      {coachLoading ? (
                        <div className="flex items-center gap-3">
                          <div className="h-1 w-1 animate-bounce rounded-full bg-[#00d4ff]/60" style={{ animationDelay: "0ms" }} />
                          <div className="h-1 w-1 animate-bounce rounded-full bg-[#00d4ff]/60" style={{ animationDelay: "150ms" }} />
                          <div className="h-1 w-1 animate-bounce rounded-full bg-[#00d4ff]/60" style={{ animationDelay: "300ms" }} />
                          <span className="font-mono text-[11px] text-white/50">Analysing your strategy…</span>
                        </div>
                      ) : coachText ? (
                        <p className="text-sm md:text-base leading-relaxed text-white/70">{coachText}</p>
                      ) : (
                        <p className="font-mono text-[11px] text-white/45">Coach unavailable</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Test footer */}
            <div className="border-t border-[#30d158]/20 px-6 py-4 md:px-8 md:py-5">
              {testStep === "horizon" && (
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  onClick={() => setTestStep("events")}
                  className="w-full rounded-xl border border-[#30d158]/40 bg-[#30d158]/10 py-3.5 md:py-4 font-mono text-sm md:text-base font-bold uppercase tracking-widest text-[#30d158] transition-all hover:bg-[#30d158]/20">
                  NEXT → SELECT EVENTS
                </motion.button>
              )}
              {testStep === "events" && (
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  onClick={runTest}
                  className="w-full rounded-xl border border-[#30d158]/40 bg-[#30d158]/10 py-3.5 md:py-4 font-mono text-sm md:text-base font-bold uppercase tracking-widest text-[#30d158] transition-all hover:bg-[#30d158]/20">
                  ▶ RUN SIMULATION
                </motion.button>
              )}
              {testStep === "results" && (
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  onClick={() => { setTestStep("events"); setSimResult(null); }}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-3.5 md:py-4 font-mono text-sm md:text-base font-bold uppercase tracking-widest text-white/40 transition-all hover:bg-white/[0.06]">
                  ↺ RUN AGAIN
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Strategy card ─── */
function StrategyCard({ strategy, onDelete, onEdit, onTest, onBattle }: {
  strategy: Strategy;
  onDelete: () => void;
  onEdit: () => void;
  onTest: () => void;
  onBattle: () => void;
}) {
  const entries = Object.entries(strategy.allocation).sort(([, a], [, b]) => b - a);
  const ret     = strategy.result?.total_return ?? null;
  const isPos   = ret === null || ret >= 0;

  return (
    <div className="flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 md:p-6 transition-all hover:border-white/10">
      {/* Name + return */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <p className="font-mono text-sm md:text-base font-bold text-white">{strategy.name}</p>
        {ret !== null && (
          <p className="font-mono text-sm md:text-base font-bold tabular-nums flex-shrink-0" style={{ color: isPos ? "#30d158" : "#ff453a" }}>
            {isPos ? "+" : ""}{ret.toFixed(1)}%
          </p>
        )}
      </div>

      {/* Allocation bars */}
      <div className="flex-1 space-y-2">
        {entries.map(([key, pct]) => {
          const cls   = ASSET_CLASSES[key as AssetClassKey];
          const color = cls?.color ?? "#555";
          const label = cls?.label ?? key;
          return (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono text-[9px] md:text-xs uppercase tracking-widest text-white/50">{label}</span>
                <span className="font-mono text-[9px] md:text-xs tabular-nums text-white/55">{pct}%</span>
              </div>
              <div className="h-1 md:h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, opacity: 0.7 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="mt-5 space-y-2 border-t border-white/[0.05] pt-4">
        <div className="grid grid-cols-3 gap-2">
          <button onClick={onDelete}
            className="rounded-lg border border-white/[0.06] py-2 md:py-2.5 font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/50 transition-all hover:border-[#ff453a]/40 hover:bg-[#ff453a]/08 hover:text-[#ff453a]">
            DELETE
          </button>
          <button onClick={onEdit}
            className="rounded-lg border border-white/[0.06] py-2 md:py-2.5 font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/50 transition-all hover:border-[#00d4ff]/40 hover:bg-[#00d4ff]/08 hover:text-[#00d4ff]">
            EDIT
          </button>
          <button onClick={onTest}
            className="rounded-lg border border-[#30d158]/30 bg-[#30d158]/08 py-2 md:py-2.5 font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#30d158] transition-all hover:bg-[#30d158]/15">
            TEST
          </button>
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={onBattle}
          className="w-full rounded-lg border border-[#ff9f0a]/35 bg-[#ff9f0a]/08 py-2.5 md:py-3 font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#ff9f0a] transition-all hover:bg-[#ff9f0a]/15">
          ⚔ BATTLE MODE
        </motion.button>
      </div>
    </div>
  );
}

/* ─── Metric tile ─── */
function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 md:p-5">
      <p className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-white/50">{label}</p>
      <p className="mt-1 font-mono text-xl md:text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}
