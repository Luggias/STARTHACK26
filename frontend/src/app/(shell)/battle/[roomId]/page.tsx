"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { useGameStore } from "@/store/game-store";
import { createBattleSocket } from "@/lib/ws";
import { getAiInsight } from "@/lib/api";
import { ASSET_KEYS } from "@/lib/constants";
import type { Allocation, BattlePhase, WsMessage } from "@/lib/types";
import PortfolioBuilder from "@/components/portfolio-builder";
import PerformanceChart from "@/components/performance-chart";
import AiInsight from "@/components/ai-insight";

export default function BattleRoomPage() {
  const params   = useParams();
  const router   = useRouter();
  const roomId   = params.roomId as string;

  const user       = useGameStore((s) => s.user);
  const playerName = useGameStore((s) => s.playerName);
  const allocation = useGameStore((s) => s.allocation);
  const setAssetAllocation = useGameStore((s) => s.setAssetAllocation);
  const resetAllocation    = useGameStore((s) => s.resetAllocation);

  const player = user
    ? { id: user.id, username: user.username }
    : playerName
      ? { id: "guest-" + playerName.toLowerCase().replace(/\s+/g, "-"), username: playerName }
      : null;

  const [phase, setPhase]             = useState<BattlePhase>("waiting");
  const [opponent, setOpponent]       = useState("");
  const [timeLeft, setTimeLeft]       = useState(60);
  const [submitted, setSubmitted]     = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [scenarioName, setScenarioName] = useState("");
  const [months, setMonths]           = useState<string[]>([]);
  const [p1Values, setP1Values]       = useState<number[]>([]);
  const [p2Values, setP2Values]       = useState<number[]>([]);
  const [winnerId, setWinnerId]       = useState<string | null>(null);
  const [p1Result, setP1Result]       = useState<Record<string, unknown> | null>(null);
  const [p2Result, setP2Result]       = useState<Record<string, unknown> | null>(null);
  const [aiInsight, setAiInsight]     = useState("");

  const socketRef = useRef<ReturnType<typeof createBattleSocket> | null>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleMessage = useCallback((msg: WsMessage) => {
    switch (msg.type) {
      case "waiting":   setPhase("waiting"); break;
      case "matched":   setOpponent((msg.opponent ?? msg.opponent_for_p2 ?? "Opponent") as string); break;
      case "building":
        setPhase("building");
        setTimeLeft((msg.time_limit as number) || 60);
        setScenarioName(((msg.scenario as Record<string, string>)?.name) || "");
        break;
      case "opponent_ready": setOpponentReady(true); break;
      case "scenario":  setScenarioName((msg.name as string) || ""); break;
      case "tick": {
        setPhase("simulating");
        setMonths((p) => { const m = msg.month as string; return p.includes(m) ? p : [...p, m]; });
        setP1Values((p) => [...p.slice(0, msg.index as number), msg.p1_value as number]);
        setP2Values((p) => [...p.slice(0, msg.index as number), msg.p2_value as number]);
        break;
      }
      case "result":
        setPhase("finished");
        setWinnerId(msg.winner_id as string | null);
        setP1Result(msg.p1 as Record<string, unknown>);
        setP2Result(msg.p2 as Record<string, unknown>);
        if (player && msg.winner_id === player.id) confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        break;
      case "opponent_disconnected":
        setOpponent((p) => p + " (disconnected)");
        break;
    }
  }, [player]);

  useEffect(() => {
    if (!player || !roomId) return;
    resetAllocation(); setMonths([]); setP1Values([]); setP2Values([]);
    const s = createBattleSocket(roomId, handleMessage);
    socketRef.current = s;
    setTimeout(() => s.send({ type: "join", player_id: player.id, username: player.username }), 300);
    return () => { s.close(); if (timerRef.current) clearInterval(timerRef.current); };
  }, [roomId, player, handleMessage, resetAllocation]);

  useEffect(() => {
    if (phase !== "building") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((p) => { if (p <= 1) { clearInterval(timerRef.current!); if (!submitted) handleSubmit(); return 0; } return p - 1; });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== "finished" || !p1Result || !p2Result) return;
    getAiInsight(
      p1Result.portfolio as Allocation, p2Result.portfolio as Allocation,
      (p1Result.scenario_key as string) || "2008_crisis",
      { p1_return: p1Result.total_return as number, p1_sharpe: p1Result.sharpe_ratio as number, p2_return: p2Result.total_return as number, p2_sharpe: p2Result.sharpe_ratio as number },
    ).then(setAiInsight).catch(() => setAiInsight("Great match! Diversification and risk management are key to long-term success."));
  }, [phase, p1Result, p2Result]);

  function handleSubmit() {
    if (submitted) return;
    if (ASSET_KEYS.reduce((s, k) => s + allocation[k], 0) !== 100) return;
    socketRef.current?.send({ type: "submit_portfolio", player_id: player?.id, allocation });
    setSubmitted(true);
  }

  if (!player) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-sm text-white/40">Please log in first.</p>
          <button onClick={() => router.push("/")} className="rounded-full bg-[#0071e3] px-6 py-2.5 text-sm font-semibold text-white">
            Go home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {/* Waiting */}
      {phase === "waiting" && (
        <motion.div className="flex min-h-[60vh] flex-col items-center justify-center text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="mb-6 h-10 w-10 animate-spin rounded-full border-2 border-[#bf5af2] border-t-transparent" />
          <h2 className="text-xl font-semibold text-white">Waiting for opponent…</h2>
          <p className="mt-2 text-sm text-white/30">Room <span className="font-mono-data text-white/50">{roomId}</span></p>
          <p className="mt-1 text-xs text-white/20">Share this URL to invite a friend</p>
        </motion.div>
      )}

      {/* Building */}
      {phase === "building" && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-6 flex items-center justify-between">
            <PlayerChip name={player.username} color="#2997ff" label="You" />
            <span className="text-lg font-bold text-white/20">VS</span>
            <PlayerChip name={opponent} color="#ff453a" label="Opponent" right />
          </div>

          <div className="glass mb-6 flex items-center justify-between rounded-xl px-5 py-3">
            <p className="text-sm text-white/50">
              Scenario <span className="font-semibold text-white">{scenarioName}</span>
            </p>
            <p className={`font-mono-data text-lg font-bold transition-colors ${timeLeft <= 10 ? "text-[#ff453a] animate-pulse" : "text-[#2997ff]"}`}>
              {timeLeft}s
            </p>
          </div>

          {!submitted ? (
            <>
              <div className="glass rounded-2xl p-6">
                <PortfolioBuilder allocation={allocation} onAssetChange={setAssetAllocation} onReset={resetAllocation} />
              </div>
              <motion.button
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                onClick={handleSubmit}
                className="mt-4 w-full rounded-full bg-white py-3.5 text-sm font-semibold text-black hover:bg-white/90 transition-all"
              >
                Lock In Portfolio
              </motion.button>
            </>
          ) : (
            <div className="glass rounded-2xl py-12 text-center">
              <p className="text-base font-semibold text-[#30d158]">Portfolio locked ✓</p>
              <p className="mt-1 text-sm text-white/30">
                {opponentReady ? "Both ready — starting…" : "Waiting for opponent…"}
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Simulating */}
      {phase === "simulating" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2 className="mb-1 text-center text-xl font-bold text-white">{scenarioName}</h2>
          <p className="mb-5 text-center text-sm text-white/30">Live simulation in progress…</p>
          <div className="mb-4 flex justify-center gap-6 text-xs">
            <Legend color="#2997ff" label={player.username} />
            <Legend color="#ff453a" label={opponent} />
          </div>
          <div className="glass rounded-2xl p-5">
            <PerformanceChart months={months} values={p1Values} values2={p2Values} animate={false} color="#2997ff" color2="#ff453a" />
          </div>
        </motion.div>
      )}

      {/* Finished */}
      {phase === "finished" && p1Result && p2Result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Winner */}
          <motion.div
            className="mb-8 text-center"
            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 14 }}
          >
            {winnerId ? (
              <>
                <p className="text-xs text-white/30 mb-1">Winner</p>
                <h2 className="text-4xl font-bold" style={{ color: winnerId === player.id ? "#2997ff" : "#ff453a" }}>
                  {winnerId === player.id ? player.username : opponent}
                </h2>
                {winnerId === player.id && <p className="mt-2 text-2xl">🎉</p>}
              </>
            ) : (
              <>
                <p className="text-xs text-white/30 mb-1">Result</p>
                <h2 className="text-4xl font-bold text-[#ff9f0a]">Tie</h2>
              </>
            )}
          </motion.div>

          {/* Stats */}
          <div className="glass mb-5 grid grid-cols-3 rounded-2xl p-5 gap-y-4 text-center">
            <p className="text-sm font-semibold text-[#2997ff]">{p1Result.username as string}</p>
            <p className="text-xs text-white/25 self-center"></p>
            <p className="text-sm font-semibold text-[#ff453a]">{p2Result.username as string}</p>
            <StatRow v1={`$${(p1Result.final_value as number).toFixed(0)}`} label="Final" v2={`$${(p2Result.final_value as number).toFixed(0)}`} />
            <StatRow v1={`${(p1Result.total_return as number) >= 0 ? "+" : ""}${(p1Result.total_return as number).toFixed(1)}%`} label="Return" v2={`${(p2Result.total_return as number) >= 0 ? "+" : ""}${(p2Result.total_return as number).toFixed(1)}%`} />
            <StatRow v1={(p1Result.sharpe_ratio as number).toFixed(2)} label="Sharpe" v2={(p2Result.sharpe_ratio as number).toFixed(2)} />
          </div>

          {/* Chart */}
          <div className="glass mb-5 rounded-2xl p-5">
            <PerformanceChart months={months} values={p1Values} values2={p2Values} animate={false} color="#2997ff" color2="#ff453a" />
          </div>

          {aiInsight && <div className="mb-5"><AiInsight text={aiInsight} /></div>}

          <div className="flex justify-center gap-3">
            <button onClick={() => router.push("/battle")} className="rounded-full bg-[#bf5af2] px-7 py-3 text-sm font-semibold text-white hover:bg-[#c56df5] transition-all">
              Play Again
            </button>
            <button onClick={() => router.push("/sandbox")} className="rounded-full border border-white/[0.1] px-7 py-3 text-sm font-semibold text-white/60 hover:bg-white/[0.04] transition-all">
              Sandbox
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function PlayerChip({ name, color, label, right }: { name: string; color: string; label: string; right?: boolean }) {
  return (
    <div className={`flex flex-col ${right ? "items-end text-right" : "items-start"}`}>
      <p className="text-xs text-white/30">{label}</p>
      <p className="text-base font-semibold" style={{ color }}>{name}</p>
    </div>
  );
}
function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2 text-white/50">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
function StatRow({ v1, label, v2 }: { v1: string; label: string; v2: string }) {
  return (
    <>
      <p className="font-mono-data text-base font-semibold text-white">{v1}</p>
      <p className="text-xs text-white/25 self-center">{label}</p>
      <p className="font-mono-data text-base font-semibold text-white">{v2}</p>
    </>
  );
}
