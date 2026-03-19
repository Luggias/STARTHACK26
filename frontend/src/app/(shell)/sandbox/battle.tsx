"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Strategy } from "@/lib/types";
import { BattleStage } from "./battle-stage";

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


/* ── Chart with time axis + value axis ── */
function BattleChart({ pH, cH }: { pH: number[]; cH: number[] }) {
  if (pH.length < 2) return <div className="w-full" style={{ height: 112 }} />;

  /* Layout constants */
  const VW = 540; const VH = 96;
  const ML = 50; const MR = 8; const MT = 6; const MB = 22;
  const CW = VW - ML - MR; const CH = VH - MT - MB;

  /* Value range */
  const all = [...pH, ...cH, 10000];
  const rawMin = Math.min(...all); const rawMax = Math.max(...all);
  const vPad = (rawMax - rawMin) * 0.12 || 300;
  const mn = rawMin - vPad; const mx = rawMax + vPad; const rng = mx - mn;
  const n = pH.length;

  /* Coordinate helpers */
  const px = (i: number) => ML + (i / (n - 1)) * CW;
  const py = (v: number) => MT + CH - ((v - mn) / rng) * CH;

  const pLine = pH.map((v, i) => `${px(i)},${py(v)}`).join(" L ");
  const cLine = cH.map((v, i) => `${px(i)},${py(v)}`).join(" L ");
  const pLx = px(n - 1); const pLy = py(pH[n - 1]);
  const cLx = px(cH.length - 1); const cLy = py(cH[cH.length - 1]);

  const pArea = `M ${ML},${MT + CH} L ${pLine} L ${pLx},${MT + CH} Z`;
  const cArea = `M ${ML},${MT + CH} L ${cLine} L ${cLx},${MT + CH} Z`;
  const breakY = py(10000);

  /* Y-axis: 4 nice labels */
  const yStep = (mx - mn) / 3;
  const yLabels = [0, 1, 2, 3].map(i => {
    const v = mn + i * yStep;
    const label = Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`;
    return { y: py(v), label };
  });

  /* X-axis: years 0, 2, 4, 6, 8, 10 at fixed proportional positions */
  const xLabels = [0, 2, 4, 6, 8, 10].map(yr => ({
    x: ML + (yr / 10) * CW,
    label: `Y${yr}`,
  }));

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: "100%", height: "auto" }}>
      <defs>
        <linearGradient id="gradBull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="gradBear" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff453a" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#ff453a" stopOpacity="0.02" />
        </linearGradient>
        <clipPath id="chartClip">
          <rect x={ML} y={MT} width={CW} height={CH} />
        </clipPath>
      </defs>

      {/* Y-axis grid lines + labels */}
      {yLabels.map(({ y, label }, i) => (
        <g key={i}>
          <line x1={ML} y1={y} x2={ML + CW} y2={y}
            stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x={ML - 5} y={y + 3.5} textAnchor="end" fontSize="9"
            fill="rgba(255,255,255,0.32)" fontFamily="monospace">{label}</text>
        </g>
      ))}

      {/* Breakeven line at $10,000 — highlighted */}
      <line x1={ML} y1={breakY} x2={ML + CW} y2={breakY}
        stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" strokeDasharray="7,4" />
      <text x={ML - 5} y={breakY + 3.5} textAnchor="end" fontSize="9"
        fill="rgba(255,255,255,0.5)" fontFamily="monospace">$10k</text>

      {/* X-axis baseline */}
      <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH}
        stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

      {/* X-axis year ticks + labels */}
      {xLabels.map(({ x, label }) => (
        <g key={label}>
          <line x1={x} y1={MT + CH} x2={x} y2={MT + CH + 5}
            stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <text x={x} y={MT + CH + 16} textAnchor="middle" fontSize="9"
            fill="rgba(255,255,255,0.35)" fontFamily="monospace">{label}</text>
        </g>
      ))}

      {/* Gradient fills — clipped */}
      <g clipPath="url(#chartClip)">
        <path d={pArea} fill="url(#gradBull)" />
        <path d={cArea} fill="url(#gradBear)" />
      </g>

      {/* Lines — clipped */}
      <g clipPath="url(#chartClip)">
        <path d={`M ${pLine}`} fill="none" stroke="#00d4ff" strokeWidth="2.5" strokeLinejoin="round" />
        <path d={`M ${cLine}`} fill="none" stroke="#ff453a" strokeWidth="2.5" strokeLinejoin="round" />
      </g>

      {/* Live endpoint dots */}
      <circle cx={pLx} cy={pLy} r="5" fill="#00d4ff" />
      <circle cx={cLx} cy={cLy} r="5" fill="#ff453a" />
    </svg>
  );
}

/* ═══════════════════════════════
   MAIN BATTLE ARENA
═══════════════════════════════ */
export interface BattleArenaProps {
  strategy: Strategy;
  playerName: string;
  onClose: () => void;
  onResult: (won: boolean, returnPct: number, cpuReturnPct: number) => void;
}

export function BattleArena({ strategy, playerName, onClose, onResult }: BattleArenaProps) {

  /* Phase & display state */
  const [phase, setPhase]           = useState<"countdown" | "fighting" | "paused" | "done">("countdown");
  const [countdown, setCd]          = useState(3);
  const [month, setMonth]           = useState(0);
  const [pH, setPH]                 = useState<number[]>([10000]);
  const [cH, setCH]                 = useState<number[]>([10000]);
  const [pendingEv, setPendingEv]   = useState<BEv | null>(null);
  const [reactTimer, setReactTimer] = useState(6);
  const [won, setWon]               = useState(false);

  /* Combat animation state */
  const [pAttack, setPAttack]   = useState(false);
  const [cAttack, setCAttack]   = useState(false);
  const [clashing, setClashing] = useState(false);
  const [pHit, setPHit]         = useState(false);
  const [cHit, setCHit]         = useState(false);

  /* All mutable sim state in a single ref to avoid stale closures */
  const sim = useRef({
    month: 0, eventIdx: 0, pPV: 10000, cPV: 10000,
    pRNG: makeLCG(Math.random() * 2 ** 32 | 0),
    cRNG: makeLCG(Math.random() * 2 ** 32 | 0),
    events: [] as { ev: BEv; atMonth: number }[],
    pendingShocks: null as Record<string, number> | null,
  });

  /* Pick events once on mount */
  useEffect(() => {
    const neg  = EVENTS.filter(e => e.type === "negative");
    const all  = [...EVENTS];
    const ev1  = neg[Math.floor(Math.random() * neg.length)];
    const rest = all.filter(e => e.key !== ev1.key);
    const ev2  = rest[Math.floor(Math.random() * rest.length)];
    sim.current.events = [
      { ev: ev1, atMonth: 22 + Math.floor(Math.random() * 20) },
      { ev: ev2, atMonth: 68 + Math.floor(Math.random() * 22) },
    ];
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
      const nextM = s.month + 1;
      if (s.eventIdx < 2 && s.events[s.eventIdx]?.atMonth === nextM) {
        s.pendingShocks = s.events[s.eventIdx].ev.shocks;
        setPendingEv(s.events[s.eventIdx].ev);
        setReactTimer(6);
        setPhase("paused");
        return;
      }
      s.pPV = stepPV(s.pPV, strategy.allocation, s.pRNG.randn);
      s.cPV = stepPV(s.cPV, CPU_ALLOC, s.cRNG.randn);
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
    s.cPV = stepPV(s.cPV, CPU_ALLOC, s.cRNG.randn, shocks, 1.0);
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
            <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.4em] text-[#00d4ff]/55">BATTLE COMMENCING IN</p>
            <AnimatePresence mode="wait">
              <motion.p key={countdown}
                className="font-mono font-bold leading-none"
                style={{ fontSize: "10rem", color: countdown === 0 ? "#ff9f0a" : "#00d4ff", textShadow: `0 0 70px ${countdown === 0 ? "#ff9f0a" : "#00d4ff"}` }}
                initial={{ scale: 1.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.3, opacity: 0 }}>
                {countdown === 0 ? "⚔" : countdown}
              </motion.p>
            </AnimatePresence>
            <div className="mt-8 flex items-center gap-6">
              <div className="text-right">
                <p className="font-mono text-xs font-bold text-[#00d4ff]">{playerName}</p>
                <p className="font-mono text-[10px] text-[#00d4ff]/50">THE KNIGHT</p>
              </div>
              <span className="font-mono text-sm text-white/20">VS</span>
              <div>
                <p className="font-mono text-xs font-bold text-[#ff453a]">A.I. FUND</p>
                <p className="font-mono text-[10px] text-[#ff453a]/50">THE KNIGHT</p>
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
            <motion.div className="w-full max-w-sm px-6" initial={{ scale: 0.88, y: 24 }} animate={{ scale: 1, y: 0 }}>
              <div className="mb-3 flex items-center gap-2">
                <motion.div className="h-2 w-2 rounded-full" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.6, repeat: Infinity }}
                  style={{ background: pendingEv.type === "negative" ? "#ff453a" : "#30d158" }} />
                <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: pendingEv.type === "negative" ? "#ff453a" : "#30d158" }}>
                  {pendingEv.type === "negative" ? "⚠ CRISIS EVENT" : "✦ MARKET EVENT"} · REACT IN {reactTimer}s
                </span>
              </div>
              <p className="mb-2 font-mono text-3xl font-bold text-white leading-tight">{pendingEv.label}</p>
              <p className="mb-7 text-sm leading-relaxed text-white/55">{pendingEv.description}</p>
              <div className="space-y-2">
                {REACTIONS.map(r => (
                  <motion.button key={r.key} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => resolveEvent(r.key)}
                    className="w-full rounded-xl border px-5 py-4 text-left transition-all"
                    style={{ borderColor: `${r.color}45`, background: `${r.color}0d` }}>
                    <p className="font-mono text-sm font-bold" style={{ color: r.color }}>{r.label}</p>
                    <p className="mt-0.5 text-xs text-white/45">{r.desc}</p>
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
          <motion.div className="absolute inset-0 z-30 flex flex-col items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.p className="font-mono font-bold leading-none"
              style={{ fontSize: "clamp(4rem,12vw,8rem)", color: won ? "#30d158" : "#ff453a", textShadow: `0 0 80px ${won ? "#30d158" : "#ff453a"}` }}
              initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200 }}>
              {won ? "VICTORY" : "DEFEAT"}
            </motion.p>
            <p className="mt-3 font-mono text-sm text-white/45">{playerName} · {strategy.name}</p>
            <div className="mt-8 flex gap-8">
              <div className="text-center">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#00d4ff]/55">YOUR RETURN</p>
                <p className="font-mono text-2xl font-bold" style={{ color: pRet >= 0 ? "#30d158" : "#ff453a" }}>{pRet >= 0 ? "+" : ""}{pRet.toFixed(1)}%</p>
              </div>
              <div className="w-px bg-white/10" />
              <div className="text-center">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#ff453a]/55">A.I. RETURN</p>
                <p className="font-mono text-2xl font-bold" style={{ color: cRet >= 0 ? "#30d158" : "#ff453a" }}>{cRet >= 0 ? "+" : ""}{cRet.toFixed(1)}%</p>
              </div>
            </div>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onClose}
              className="mt-10 rounded-xl border border-[#00d4ff]/40 bg-[#00d4ff]/10 px-8 py-3 font-mono text-sm font-bold uppercase tracking-widest text-[#00d4ff] transition-all hover:bg-[#00d4ff]/20">
              RETURN TO SANDBOX
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-[#00d4ff]/10 px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-bold text-[#00d4ff]">⚔ ARENA</span>
          <span className="font-mono text-[10px] text-white/35 uppercase tracking-widest">YEAR {year} / 10</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div className="h-full rounded-full bg-[#00d4ff]" style={{ width: `${(month / BATTLE_MONTHS) * 100}%` }} />
          </div>
          {phase !== "fighting" && phase !== "paused" && (
            <button onClick={onClose} className="font-mono text-sm text-white/40 hover:text-white/70 transition-colors">×</button>
          )}
        </div>
      </div>

      {/* ── HP bars ── */}
      <div className="grid grid-cols-2 gap-px border-b border-white/[0.04]">
        <div className="px-6 py-3 border-r border-white/[0.04]">
          <div className="mb-1 flex items-center justify-between">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#00d4ff]">{playerName}</span>
              <span className="ml-2 font-mono text-[9px] text-[#00d4ff]/40">THE KNIGHT</span>
            </div>
            <span className="font-mono text-sm font-bold tabular-nums" style={{ color: pRet >= 0 ? "#30d158" : "#ff453a" }}>{pRet >= 0 ? "+" : ""}{pRet.toFixed(1)}%</span>
          </div>
          <motion.div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]"
            animate={pDesperate ? { boxShadow: ["0 0 0px #ff453a00", "0 0 8px #ff453a80", "0 0 0px #ff453a00"] } : {}}
            transition={pDesperate ? { duration: 0.9, repeat: Infinity } : {}}>
            <motion.div className="h-full rounded-full" layout
              style={{ width: `${Math.min(100, (pCur / 18000) * 100)}%`, background: pCur < 10000 ? "linear-gradient(90deg,#ff453a,#ff9f0a)" : "linear-gradient(90deg,#00d4ff,#7c3aed)" }}
              transition={{ duration: 0.4 }} />
          </motion.div>
          <p className="mt-1 font-mono text-[10px] tabular-nums text-white/50">${pCur.toFixed(0)}</p>
        </div>
        <div className="px-6 py-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono text-sm font-bold tabular-nums" style={{ color: cRet >= 0 ? "#30d158" : "#ff453a" }}>{cRet >= 0 ? "+" : ""}{cRet.toFixed(1)}%</span>
            <div className="text-right">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#ff453a]">A.I. FUND</span>
              <span className="ml-2 font-mono text-[9px] text-[#ff453a]/40">THE KNIGHT</span>
            </div>
          </div>
          <motion.div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]"
            animate={cDesperate ? { boxShadow: ["0 0 0px #ff453a00", "0 0 8px #ff453a80", "0 0 0px #ff453a00"] } : {}}
            transition={cDesperate ? { duration: 0.9, repeat: Infinity } : {}}>
            <motion.div className="h-full rounded-full" layout
              style={{ width: `${Math.min(100, (cCur / 18000) * 100)}%`, background: cCur < 10000 ? "linear-gradient(90deg,#ff453a,#ff9f0a)" : "linear-gradient(90deg,#ff453a,#ff9f0a)" }}
              transition={{ duration: 0.4 }} />
          </motion.div>
          <p className="mt-1 font-mono text-[10px] tabular-nums text-right text-white/50">${cCur.toFixed(0)}</p>
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
        <div className="px-5 pb-5">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5"><div className="h-px w-5 bg-[#00d4ff]" /><span className="font-mono text-[9px] uppercase tracking-widest text-[#00d4ff]/60">{playerName}</span></div>
              <div className="flex items-center gap-1.5"><div className="h-px w-5 bg-[#ff453a]" /><span className="font-mono text-[9px] uppercase tracking-widest text-[#ff453a]/60">A.I. FUND</span></div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-px w-5 border-t border-dashed border-white/30" />
              <span className="font-mono text-[9px] text-white/35">$10,000 START</span>
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] px-3 py-2">
            <BattleChart pH={pH} cH={cH} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
