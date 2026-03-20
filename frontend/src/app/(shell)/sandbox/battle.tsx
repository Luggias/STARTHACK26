"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Strategy, Allocation } from "@/lib/types";
import { BattleStage } from "./battle-stage";
import { getAiInsight, presenceRematch, presenceCheckRematch } from "@/lib/api";
import PerformanceChart from "@/components/performance-chart";
import AiInsight from "@/components/ai-insight";

/* ── Simulation ── */
const SIM: Record<string, { mu: number; sigma: number }> = {
  equities:    { mu: 0.06,  sigma: 0.22 },
  etfs:        { mu: 0.055, sigma: 0.17 },
  bonds:       { mu: 0.02,  sigma: 0.07 },
  commodities: { mu: 0.03,  sigma: 0.24 },
};
const CPU_ALLOC: Record<string, number> = { equities: 40, bonds: 35, commodities: 25 };
const BATTLE_MONTHS = 120;
const MS_PER_MONTH  = 470;

/* ── Events ── */
interface BEv { key: string; label: string; description: string; type: "positive" | "negative"; shocks: Record<string, number> }
const EVENTS: BEv[] = [
  { key: "crash",     type: "negative", label: "MARKET CRASH",      description: "Panic selling triggers a broad collapse. Equities in freefall.",                 shocks: { equities: -0.50, etfs: -0.44, bonds: 0.08,  commodities:  0.12 } },
  { key: "recession", type: "negative", label: "RECESSION",         description: "Economy contracts sharply. Corporate earnings collapse. Unemployment spikes.",    shocks: { equities: -0.40, etfs: -0.35, bonds: 0.10,  commodities: -0.22 } },
  { key: "war",       type: "negative", label: "WAR & CONFLICT",    description: "Military conflict disrupts global supply chains. Energy and metals surge.",       shocks: { equities: -0.30, etfs: -0.25, bonds: -0.15, commodities:  0.40 } },
  { key: "rate_hike", type: "negative", label: "RATE HIKE",         description: "Central banks raise rates aggressively. Growth assets and bonds hammered.",       shocks: { equities: -0.22, etfs: -0.19, bonds: -0.28, commodities:  0.04 } },
  { key: "pandemic",  type: "negative", label: "PANDEMIC",          description: "Global health crisis halts economic activity. Markets price in years of pain.",   shocks: { equities: -0.38, etfs: -0.33, bonds: 0.07,  commodities: -0.25 } },
  { key: "tech_boom", type: "positive", label: "TECH BOOM",         description: "AI breakthroughs send equity markets to all-time highs. Growth stocks surge.",    shocks: { equities:  0.28, etfs: 0.22,  bonds: -0.03, commodities:  0.02 } },
  { key: "rate_cut",  type: "positive", label: "RATE CUT",          description: "Central banks slash rates. Cheap money floods into risk assets — rally time.",    shocks: { equities:  0.18, etfs: 0.15,  bonds: 0.22,  commodities:  0.04 } },
  { key: "boom",      type: "positive", label: "ECONOMIC BOOM",     description: "GDP surges, unemployment hits record lows. Corporate earnings smash forecasts.",   shocks: { equities:  0.24, etfs: 0.20,  bonds: -0.04, commodities:  0.14 } },
];
const REACTIONS = [
  { key: "hold",   label: "⚔  HOLD THE LINE",      desc: "Stay the course — absorb the full shock.",            mult: 1.0, color: "#00d4ff" },
  { key: "defend", label: "🛡  RETREAT TO SAFETY",  desc: "Hedge exposure — take only 40% of the impact.",      mult: 0.4, color: "#30d158" },
  { key: "press",  label: "⚡  DOUBLE DOWN",         desc: "Go all-in — 150% exposure, high risk / high reward.", mult: 1.5, color: "#ff9f0a" },
] as const;

/* ── Helpers ── */
function makeLCG(seed: number) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  const rand  = () => { s = Math.imul(1664525, s) + 1013904223 >>> 0; return s / 4294967296; };
  const randn = () => Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-10))) * Math.cos(2 * Math.PI * rand());
  return { rand, randn };
}
function stepPV(pv: number, alloc: Record<string, number>, randn: () => number, shocks: Record<string, number> = {}, mult = 1): number {
  let r = 0;
  for (const [k, pct] of Object.entries(alloc)) {
    if (!pct) continue;
    const p = SIM[k] ?? { mu: 0.06, sigma: 0.20 };
    const drift = (p.mu - 0.5 * p.sigma ** 2) / 12;
    const diff  = (p.sigma / Math.sqrt(12)) * randn();
    let ret = Math.exp(drift + diff) - 1;
    if (shocks[k] !== undefined) ret += shocks[k] * mult;
    r += (pct / 100) * ret;
  }
  return Math.max(10, pv * (1 + r));
}



/* ═══════════════════════════════
   MAIN BATTLE ARENA
═══════════════════════════════ */
export interface BattleArenaProps {
  strategy: Strategy;
  playerName: string;
  onClose: () => void;
  onResult: (won: boolean, returnPct: number, cpuReturnPct: number) => void;
  /** PvP mode: opponent's name and allocation */
  opponentName?: string;
  opponentAllocation?: Record<string, number>;
  /** Shared seed for deterministic PvP simulation */
  seed?: number;
  /** Called when user wants to play again */
  onPlayAgain?: () => void;
}

export function BattleArena({ strategy, playerName, onClose, onResult, opponentName, opponentAllocation, onPlayAgain, seed }: BattleArenaProps) {

  const isPvP = !!opponentName;
  const enemyName = opponentName ?? "A.I. FUND";
  const enemyAlloc = opponentAllocation ?? CPU_ALLOC;

  /* Phase & display state */
  const [phase, setPhase]           = useState<"countdown" | "fighting" | "paused" | "done">("countdown");
  const [countdown, setCd]          = useState(3);
  const [month, setMonth]           = useState(0);
  const [pH, setPH]                 = useState<number[]>([10000]);
  const [cH, setCH]                 = useState<number[]>([10000]);
  const [pendingEv, setPendingEv]   = useState<BEv | null>(null);
  const [reactTimer, setReactTimer] = useState(6);
  const [won, setWon]               = useState(false);
  const [aiInsight, setAiInsight]   = useState("");
  const [rematchSent, setRematchSent]         = useState(false);
  const [opponentWantsRematch, setOpponentWantsRematch] = useState(false);

  /* Combat animation state */
  const [pAttack, setPAttack]   = useState(false);
  const [cAttack, setCAttack]   = useState(false);
  const [clashing, setClashing] = useState(false);
  const [pHit, setPHit]         = useState(false);
  const [cHit, setCHit]         = useState(false);

  /* All mutable sim state in a single ref to avoid stale closures */
  const baseSeed = seed ?? (Math.random() * 2 ** 32 | 0);
  const sim = useRef({
    month: 0, eventIdx: 0, pPV: 10000, cPV: 10000,
    pRNG: makeLCG(baseSeed),
    cRNG: makeLCG(baseSeed ^ 0x12345678),
    events: [] as { ev: BEv; atMonth: number }[],
    pendingShocks: null as Record<string, number> | null,
  });

  /* Pick events once on mount — use seeded RNG so both PvP players see identical events */
  useEffect(() => {
    const evRNG = makeLCG(baseSeed ^ 0xBA771E);
    const neg  = EVENTS.filter(e => e.type === "negative");
    const all  = [...EVENTS];
    const ev1  = neg[Math.floor(evRNG.rand() * neg.length)];
    const rest = all.filter(e => e.key !== ev1.key);
    const ev2  = rest[Math.floor(evRNG.rand() * rest.length)];
    sim.current.events = [
      { ev: ev1, atMonth: 22 + Math.floor(evRNG.rand() * 20) },
      { ev: ev2, atMonth: 68 + Math.floor(evRNG.rand() * 22) },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Countdown */
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown === 0) { setPhase("fighting"); return; }
    const t = setTimeout(() => setCd(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  /* Combat rhythm — both knights lunge simultaneously, swords clash, loser staggers */
  useEffect(() => {
    if (phase !== "fighting") return;
    let cancelled = false;
    const exchange = () => {
      if (cancelled) return;
      /* Both lunge at the same time */
      setPAttack(true); setCAttack(true);
      /* Swords meet in center */
      setTimeout(() => { if (!cancelled) setClashing(true); }, 150);
      setTimeout(() => { if (!cancelled) setClashing(false); }, 151);
      /* Loser takes the hit */
      setTimeout(() => {
        if (!cancelled) {
          if (pWinningRef.current) setCHit(true);
          else setPHit(true);
        }
      }, 270);
      /* Reset all — knights pull back */
      setTimeout(() => {
        if (!cancelled) { setPAttack(false); setCAttack(false); setPHit(false); setCHit(false); }
      }, 500);
      /* Next exchange: winner presses faster */
      const delay = pWinningRef.current
        ? 1200 + Math.random() * 400
        : 1800 + Math.random() * 600;
      setTimeout(exchange, 500 + delay);
    };
    exchange();
    return () => { cancelled = true; };
  }, [phase]);

  /* Let combat rhythm read current winner without stale closure */
  const pWinningRef = useRef(true);

  /* Battle tick */
  const tickRef = useRef<() => void>(() => {});
  useEffect(() => {
    tickRef.current = () => {
      const s = sim.current;
      if (s.month >= BATTLE_MONTHS) return; // guard against double-fire
      const nextM = s.month + 1;
      if (s.eventIdx < 2 && s.events[s.eventIdx]?.atMonth === nextM) {
        s.pendingShocks = s.events[s.eventIdx].ev.shocks;
        setPendingEv(s.events[s.eventIdx].ev);
        setReactTimer(6);
        setPhase("paused");
        return;
      }
      s.pPV = stepPV(s.pPV, strategy.allocation, s.pRNG.randn);
      s.cPV = stepPV(s.cPV, enemyAlloc, s.cRNG.randn);
      s.month = nextM;
      setPH(h => [...h, s.pPV]);
      setCH(h => [...h, s.cPV]);
      setMonth(nextM);
      if (nextM >= BATTLE_MONTHS) {
        const didWin = s.pPV > s.cPV;
        setWon(didWin);
        setPhase("done");
        onResult(didWin, ((s.pPV - 10000) / 10000) * 100, ((s.cPV - 10000) / 10000) * 100);
      }
    };
  });
  useEffect(() => {
    if (phase !== "fighting") return;
    const t = setInterval(() => tickRef.current(), MS_PER_MONTH);
    return () => clearInterval(t);
  }, [phase]);

  /* AI insight on battle end */
  useEffect(() => {
    if (phase !== "done") return;
    const pReturn = ((pH[pH.length - 1] - 10000) / 10000) * 100;
    const cReturn = ((cH[cH.length - 1] - 10000) / 10000) * 100;
    getAiInsight(
      strategy.allocation as unknown as Allocation, enemyAlloc as unknown as Allocation,
      "2008_crisis",
      { p1_return: pReturn, p1_sharpe: 0, p2_return: cReturn, p2_sharpe: 0 },
    ).then((text) => { if (text) setAiInsight(text); })
     .catch((err) => {
       console.error("[battle] AI insight error:", err);
       setAiInsight("Great battle! Diversification and risk management are key to long-term success.");
     });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* Poll for opponent rematch request when battle is done (PvP only) */
  useEffect(() => {
    if (phase !== "done" || !isPvP) return;
    let active = true;
    const poll = () => {
      presenceCheckRematch(playerName).then(r => {
        if (active && r.from_id === enemyName) setOpponentWantsRematch(true);
      }).catch(() => {});
    };
    poll();
    const iv = setInterval(poll, 2000);
    return () => { active = false; clearInterval(iv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* Reaction timer */
  useEffect(() => {
    if (phase !== "paused") return;
    if (reactTimer === 0) { resolveEvent("hold"); return; }
    const t = setTimeout(() => setReactTimer(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, reactTimer]);

  function resolveEvent(choice: string) {
    const s    = sim.current;
    const mult = REACTIONS.find(r => r.key === choice)?.mult ?? 1.0;
    const shocks = s.pendingShocks ?? {};
    const prevP = s.pPV; const prevC = s.cPV;
    s.pPV = stepPV(s.pPV, strategy.allocation, s.pRNG.randn, shocks, mult);
    s.cPV = stepPV(s.cPV, enemyAlloc, s.cRNG.randn, shocks, 1.0);
    s.month++; s.eventIdx++; s.pendingShocks = null;
    if (s.pPV < prevP) { setPHit(true); setTimeout(() => setPHit(false), 600); }
    if (s.cPV < prevC) { setCHit(true); setTimeout(() => setCHit(false), 600); }
    setPH(h => [...h, s.pPV]);
    setCH(h => [...h, s.cPV]);
    setMonth(s.month);
    setPendingEv(null);
    setPhase("fighting");
  }

  const pCur      = pH[pH.length - 1];
  const cCur      = cH[cH.length - 1];
  const pRet      = ((pCur - 10000) / 10000) * 100;
  const cRet      = ((cCur - 10000) / 10000) * 100;
  const pWinning  = pCur >= cCur;
  pWinningRef.current = pWinning;
  const year      = Math.floor(month / 12);
  /* How dominant is the winner: 0=tied, 1=$6k+ gap */
  const dominance = Math.min(1, Math.abs(pCur - cCur) / 6000);
  /* Is the loser critically low? */
  const pDesperate = pCur < 7500;
  const cDesperate = cCur < 7500;

  return (
    <motion.div className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ background: "#06060e", backgroundImage: "repeating-linear-gradient(rgba(0,212,255,0.02) 0, rgba(0,212,255,0.02) 1px, transparent 1px, transparent 48px), repeating-linear-gradient(90deg, rgba(0,212,255,0.02) 0, rgba(0,212,255,0.02) 1px, transparent 1px, transparent 48px)" }}>

      {/* ── Atmospheric glow — shifts toward winner's colour ── */}
      <motion.div className="pointer-events-none absolute inset-0 z-0"
        animate={{
          background: pWinning
            ? `radial-gradient(ellipse at 25% 85%, rgba(0,212,255,${0.05 + dominance * 0.1}) 0%, transparent 55%)`
            : `radial-gradient(ellipse at 75% 85%, rgba(255,69,58,${0.05 + dominance * 0.1}) 0%, transparent 55%)`,
        }}
        transition={{ duration: 1.8, ease: "easeInOut" }}
      />

      {/* ── Countdown ── */}
      <AnimatePresence>
        {phase === "countdown" && (
          <motion.div className="absolute inset-0 z-30 flex flex-col items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="mb-6 font-mono text-[10px] md:text-sm uppercase tracking-[0.4em] text-[#00d4ff]/55">BATTLE STARTS IN</p>
            <AnimatePresence mode="wait">
              <motion.p key={countdown}
                className="font-mono font-bold leading-none"
                style={{ fontSize: "10rem", color: countdown === 0 ? "#ff9f0a" : "#00d4ff", textShadow: `0 0 70px ${countdown === 0 ? "#ff9f0a" : "#00d4ff"}` }}
                initial={{ scale: 1.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.3, opacity: 0 }}>
                {countdown === 0 ? "⚔" : countdown}
              </motion.p>
            </AnimatePresence>
            <div className="mt-8 flex items-center gap-6 md:gap-10">
              <div className="text-right">
                <p className="font-mono text-xs md:text-base font-bold text-[#00d4ff]">{playerName}</p>
                <p className="font-mono text-[10px] md:text-xs text-[#00d4ff]/50">THE KNIGHT</p>
              </div>
              <span className="font-mono text-sm md:text-lg text-white/20">VS</span>
              <div>
                <p className="font-mono text-xs md:text-base font-bold text-[#ff453a]">{enemyName}</p>
                <p className="font-mono text-[10px] md:text-xs text-[#ff453a]/50">THE KNIGHT</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Event reaction popup ── */}
      <AnimatePresence>
        {phase === "paused" && pendingEv && (
          <motion.div className="absolute inset-0 z-30 flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: "rgba(0,0,0,0.92)" }}>
            <motion.div className="w-full max-w-sm md:max-w-md px-6" initial={{ scale: 0.88, y: 24 }} animate={{ scale: 1, y: 0 }}>
              <div className="mb-3 flex items-center gap-2">
                <motion.div className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.6, repeat: Infinity }}
                  style={{ background: pendingEv.type === "negative" ? "#ff453a" : "#30d158" }} />
                <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest" style={{ color: pendingEv.type === "negative" ? "#ff453a" : "#30d158" }}>
                  {pendingEv.type === "negative" ? "⚠ CRISIS EVENT" : "✦ MARKET EVENT"} · REACT IN {reactTimer}s
                </span>
              </div>
              <p className="mb-2 font-mono text-3xl md:text-4xl font-bold text-white leading-tight">{pendingEv.label}</p>
              <p className="mb-7 text-sm md:text-base leading-relaxed text-white/55">{pendingEv.description}</p>
              <div className="space-y-2 md:space-y-3">
                {REACTIONS.map(r => (
                  <motion.button key={r.key} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => resolveEvent(r.key)}
                    className="w-full rounded-xl border px-5 py-4 md:px-6 md:py-5 text-left transition-all"
                    style={{ borderColor: `${r.color}45`, background: `${r.color}0d` }}>
                    <p className="font-mono text-sm md:text-base font-bold" style={{ color: r.color }}>{r.label}</p>
                    <p className="mt-0.5 text-xs md:text-sm text-white/45">{r.desc}</p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Victory / Defeat ── */}
      <AnimatePresence>
        {phase === "done" && (
          <motion.div className="absolute inset-0 z-30 flex flex-col items-center overflow-y-auto"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ background: "rgba(6,6,14,0.92)" }}>
            <div className="flex flex-col items-center px-6 py-10 md:py-14 w-full max-w-lg">
              <motion.p className="font-mono font-bold leading-none"
                style={{ fontSize: "clamp(3.5rem,10vw,6rem)", color: won ? "#30d158" : "#ff453a", textShadow: `0 0 80px ${won ? "#30d158" : "#ff453a"}` }}
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200 }}>
                {won ? "VICTORY" : "DEFEAT"}
              </motion.p>
              <p className="mt-2 font-mono text-sm md:text-base text-white/45">{playerName} · {strategy.name}</p>
              <div className="mt-6 md:mt-8 flex gap-8 md:gap-12">
                <div className="text-center">
                  <p className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-[#00d4ff]/55">YOUR RETURN</p>
                  <p className="font-mono text-2xl md:text-3xl font-bold" style={{ color: pRet >= 0 ? "#30d158" : "#ff453a" }}>{pRet >= 0 ? "+" : ""}{pRet.toFixed(1)}%</p>
                </div>
                <div className="w-px bg-white/10" />
                <div className="text-center">
                  <p className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-[#ff453a]/55">{enemyName}</p>
                  <p className="font-mono text-2xl md:text-3xl font-bold" style={{ color: cRet >= 0 ? "#30d158" : "#ff453a" }}>{cRet >= 0 ? "+" : ""}{cRet.toFixed(1)}%</p>
                </div>
              </div>

              {/* Chart */}
              <div className="mt-6 w-full rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <PerformanceChart
                  months={pH.map((_, i) => `M${i}`)}
                  values={pH}
                  values2={cH}
                  animate={false}
                  color="#00d4ff"
                  color2="#ff453a"
                />
              </div>

              {/* AI Insight */}
              {aiInsight && (
                <div className="mt-4 w-full">
                  <AiInsight text={aiInsight} />
                </div>
              )}

              {/* Buttons */}
              <div className="mt-6 flex gap-3">
                {onPlayAgain && isPvP ? (
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      if (rematchSent && opponentWantsRematch) {
                        // Both want rematch — go!
                        onPlayAgain();
                        return;
                      }
                      presenceRematch(playerName, enemyName).then(r => {
                        setRematchSent(true);
                        if (r.mutual) onPlayAgain();
                      }).catch(() => {});
                    }}
                    className={`rounded-xl border px-8 py-3 md:px-10 md:py-4 font-mono text-sm md:text-base font-bold uppercase tracking-widest transition-all ${
                      opponentWantsRematch
                        ? "border-[#30d158]/60 bg-[#30d158]/20 text-[#30d158] animate-pulse"
                        : rematchSent
                          ? "border-[#ff9f0a]/20 bg-[#ff9f0a]/5 text-[#ff9f0a]/50"
                          : "border-[#ff9f0a]/40 bg-[#ff9f0a]/10 text-[#ff9f0a] hover:bg-[#ff9f0a]/20"
                    }`}>
                    {opponentWantsRematch ? "ACCEPT REMATCH" : rematchSent ? "WAITING FOR OPPONENT..." : "PLAY AGAIN"}
                  </motion.button>
                ) : onPlayAgain ? (
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onPlayAgain}
                    className="rounded-xl border border-[#ff9f0a]/40 bg-[#ff9f0a]/10 px-8 py-3 md:px-10 md:py-4 font-mono text-sm md:text-base font-bold uppercase tracking-widest text-[#ff9f0a] transition-all hover:bg-[#ff9f0a]/20">
                    PLAY AGAIN
                  </motion.button>
                ) : null}
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onClose}
                  className="rounded-xl border border-[#00d4ff]/40 bg-[#00d4ff]/10 px-8 py-3 md:px-10 md:py-4 font-mono text-sm md:text-base font-bold uppercase tracking-widest text-[#00d4ff] transition-all hover:bg-[#00d4ff]/20">
                  RETURN TO SANDBOX
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="border-b border-[#00d4ff]/10 px-6 py-3 md:px-8 md:py-4">
        {/* Player names + returns */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#00d4ff]">{playerName}</span>
            <span className="font-mono text-xs md:text-sm font-bold tabular-nums" style={{ color: pRet >= 0 ? "#30d158" : "#ff453a" }}>{pRet >= 0 ? "+" : ""}{pRet.toFixed(1)}%</span>
          </div>
          <span className="font-mono text-[10px] md:text-xs text-white/30 uppercase tracking-widest">YR {year}/10</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs md:text-sm font-bold tabular-nums" style={{ color: cRet >= 0 ? "#30d158" : "#ff453a" }}>{cRet >= 0 ? "+" : ""}{cRet.toFixed(1)}%</span>
            <span className="font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#ff453a]">{enemyName}</span>
          </div>
        </div>

        {/* Head-to-head bar — shows portfolio share of total */}
        <div className="flex h-3 md:h-4 w-full overflow-hidden rounded-full bg-white/[0.04]">
          <motion.div className="h-full rounded-l-full"
            style={{ width: `${(pCur / (pCur + cCur)) * 100}%`, background: pWinning ? "linear-gradient(90deg,#00d4ff,#7c3aed)" : "linear-gradient(90deg,#00d4ff80,#7c3aed60)" }}
            layout transition={{ duration: 0.4 }} />
          <motion.div className="h-full rounded-r-full"
            style={{ width: `${(cCur / (pCur + cCur)) * 100}%`, background: !pWinning ? "linear-gradient(270deg,#ff453a,#ff9f0a)" : "linear-gradient(270deg,#ff453a80,#ff9f0a60)" }}
            layout transition={{ duration: 0.4 }} />
        </div>

        {/* Portfolio values */}
        <div className="mt-1 flex items-center justify-between">
          <span className="font-mono text-[10px] md:text-xs tabular-nums text-white/40">${pCur.toFixed(0)}</span>
          <span className="font-mono text-[10px] md:text-xs tabular-nums text-white/40">${cCur.toFixed(0)}</span>
        </div>
      </div>

      {/* ── Arena floor: Pixi battle canvas + chart ── */}
      <div className="flex flex-1 flex-col min-h-0">
        {/* WebGL battle stage */}
        <div className="relative flex-1 min-h-0">
          <BattleStage
            pAttack={pAttack} cAttack={cAttack}
            pHit={pHit}       cHit={cHit}
            pWinning={pWinning}
            clashing={clashing}
            strategyName={strategy.name}
          />
        </div>

        {/* Chart */}
        <div className="px-5 pb-5 md:px-8 md:pb-6">
          <div className="mb-1.5 md:mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="flex items-center gap-1.5 md:gap-2"><div className="h-px w-5 md:w-6 bg-[#00d4ff]" /><span className="font-mono text-[9px] md:text-xs uppercase tracking-widest text-[#00d4ff]/60">{playerName}</span></div>
              <div className="flex items-center gap-1.5 md:gap-2"><div className="h-px w-5 md:w-6 bg-[#ff453a]" /><span className="font-mono text-[9px] md:text-xs uppercase tracking-widest text-[#ff453a]/60">{enemyName}</span></div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="h-px w-5 md:w-6 border-t border-dashed border-white/30" />
              <span className="font-mono text-[9px] md:text-xs text-white/35">$10,000 START</span>
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] px-1 py-1">
            <PerformanceChart
              months={pH.map((_, i) => `M${i}`)}
              values={pH}
              values2={cH}
              animate={false}
              color="#00d4ff"
              color2="#ff453a"
              height={typeof window !== "undefined" && window.innerWidth >= 768 ? Math.round(window.innerHeight * 0.25) : 140}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
