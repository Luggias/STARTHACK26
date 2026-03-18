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
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const player = useGameStore((s) => s.player);
  const allocation = useGameStore((s) => s.allocation);
  const setAssetAllocation = useGameStore((s) => s.setAssetAllocation);
  const resetAllocation = useGameStore((s) => s.resetAllocation);

  const [phase, setPhase] = useState<BattlePhase>("waiting");
  const [opponent, setOpponent] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);
  const [submitted, setSubmitted] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);

  // Simulation state
  const [scenarioName, setScenarioName] = useState("");
  const [months, setMonths] = useState<string[]>([]);
  const [p1Values, setP1Values] = useState<number[]>([]);
  const [p2Values, setP2Values] = useState<number[]>([]);

  // Results
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [p1Result, setP1Result] = useState<Record<string, unknown> | null>(null);
  const [p2Result, setP2Result] = useState<Record<string, unknown> | null>(null);
  const [aiInsight, setAiInsight] = useState("");

  const socketRef = useRef<ReturnType<typeof createBattleSocket> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleMessage = useCallback((msg: WsMessage) => {
    switch (msg.type) {
      case "waiting":
        setPhase("waiting");
        break;

      case "matched":
        setOpponent((msg.opponent as string) || (msg.opponent_for_p2 as string) || "Opponent");
        break;

      case "building":
        setPhase("building");
        setTimeLeft(msg.time_limit as number || 60);
        setScenarioName((msg.scenario as Record<string, string>)?.name || "");
        break;

      case "opponent_ready":
        setOpponentReady(true);
        break;

      case "scenario":
        setScenarioName(msg.name as string || "");
        break;

      case "tick": {
        setPhase("simulating");
        const month = msg.month as string;
        const p1v = msg.p1_value as number;
        const p2v = msg.p2_value as number;

        setMonths((prev) => {
          if (prev.includes(month)) return prev;
          return [...prev, month];
        });
        setP1Values((prev) => [...prev.slice(0, (msg.index as number)), p1v]);
        setP2Values((prev) => [...prev.slice(0, (msg.index as number)), p2v]);
        break;
      }

      case "result":
        setPhase("finished");
        setWinnerId(msg.winner_id as string | null);
        setP1Result(msg.p1 as Record<string, unknown>);
        setP2Result(msg.p2 as Record<string, unknown>);

        // Fire confetti for winner
        if (player && msg.winner_id === player.id) {
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        }
        break;

      case "opponent_disconnected":
        setOpponent((prev) => prev + " (disconnected)");
        break;
    }
  }, [player]);

  // Connect WebSocket
  useEffect(() => {
    if (!player || !roomId) return;

    resetAllocation();
    setMonths([]);
    setP1Values([]);
    setP2Values([]);

    const socket = createBattleSocket(roomId, handleMessage);
    socketRef.current = socket;

    // Join the room
    setTimeout(() => {
      socket.send({
        type: "join",
        player_id: player.id,
        username: player.username,
      });
    }, 300);

    return () => {
      socket.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [roomId, player, handleMessage, resetAllocation]);

  // Countdown timer during building phase
  useEffect(() => {
    if (phase !== "building") return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Auto-submit if time runs out
          if (!submitted) handleSubmit();
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Fetch AI insight when results arrive
  useEffect(() => {
    if (phase !== "finished" || !p1Result || !p2Result) return;

    const scenarioKey = (p1Result as Record<string, unknown>).scenario_key as string || "2008_crisis";

    getAiInsight(
      (p1Result as Record<string, unknown>).portfolio as Allocation,
      (p2Result as Record<string, unknown>).portfolio as Allocation,
      scenarioKey,
      {
        p1_return: (p1Result as Record<string, unknown>).total_return as number,
        p1_sharpe: (p1Result as Record<string, unknown>).sharpe_ratio as number,
        p2_return: (p2Result as Record<string, unknown>).total_return as number,
        p2_sharpe: (p2Result as Record<string, unknown>).sharpe_ratio as number,
      },
    )
      .then(setAiInsight)
      .catch(() => setAiInsight("Great match! Diversification and risk management are key to long-term investing success."));
  }, [phase, p1Result, p2Result]);

  function handleSubmit() {
    if (submitted) return;

    const total = ASSET_KEYS.reduce((sum, k) => sum + allocation[k], 0);
    if (total !== 100) return;

    socketRef.current?.send({
      type: "submit_portfolio",
      player_id: player?.id,
      allocation,
    });
    setSubmitted(true);
  }

  // Redirect if no player
  if (!player) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-slate-400">Please enter your username first.</p>
          <button onClick={() => router.push("/")} className="rounded-lg bg-brand-blue px-6 py-2 font-bold">
            Go to Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      {/* Waiting Phase */}
      {phase === "waiting" && (
        <motion.div
          className="flex min-h-[60vh] flex-col items-center justify-center text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-brand-purple border-t-transparent" />
          <h2 className="text-2xl font-bold">Waiting for opponent...</h2>
          <p className="mt-2 text-sm text-slate-400">
            Room: <span className="font-mono text-brand-blue">{roomId}</span>
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Share this page URL with a friend to battle!
          </p>
        </motion.div>
      )}

      {/* Building Phase */}
      {phase === "building" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* VS Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="text-center">
              <p className="text-sm text-slate-500">You</p>
              <p className="text-lg font-bold text-brand-blue">{player.username}</p>
            </div>
            <motion.div
              className="text-3xl font-extrabold text-slate-600"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.3, 1] }}
              transition={{ type: "spring", duration: 0.6 }}
            >
              VS
            </motion.div>
            <div className="text-center">
              <p className="text-sm text-slate-500">Opponent</p>
              <p className="text-lg font-bold text-red-400">{opponent}</p>
            </div>
          </div>

          {/* Scenario & Timer */}
          <div className="mb-6 flex items-center justify-between rounded-xl bg-surface-light/50 px-5 py-3">
            <p className="text-sm text-slate-300">
              Scenario: <span className="font-bold">{scenarioName}</span>
            </p>
            <p
              className={`text-lg font-bold tabular-nums ${
                timeLeft <= 10 ? "text-red-400 animate-pulse" : "text-brand-blue"
              }`}
            >
              {timeLeft}s
            </p>
          </div>

          {/* Portfolio Builder */}
          {!submitted ? (
            <>
              <PortfolioBuilder
                allocation={allocation}
                onAssetChange={setAssetAllocation}
                onReset={resetAllocation}
              />
              <button
                onClick={handleSubmit}
                className="mt-4 w-full rounded-xl bg-brand-blue py-3 text-lg font-bold
                           transition-all hover:bg-brand-blue/90"
              >
                Lock In Portfolio
              </button>
            </>
          ) : (
            <div className="mt-8 text-center">
              <p className="text-lg font-bold text-green-400">Portfolio locked!</p>
              <p className="mt-1 text-sm text-slate-400">
                {opponentReady ? "Both ready — starting simulation..." : "Waiting for opponent to lock in..."}
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Simulating Phase */}
      {phase === "simulating" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2 className="mb-2 text-center text-2xl font-extrabold">{scenarioName}</h2>
          <p className="mb-6 text-center text-sm text-slate-400">
            Watch how your portfolios perform through history...
          </p>

          <div className="flex justify-center gap-8 mb-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-brand-blue" />
              <span>{player.username}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <span>{opponent}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-surface-lighter bg-surface-light/50 p-4">
            <PerformanceChart
              months={months}
              values={p1Values}
              values2={p2Values}
              animate={false}
              color="#3B82F6"
              color2="#EF4444"
            />
          </div>
        </motion.div>
      )}

      {/* Finished Phase */}
      {phase === "finished" && p1Result && p2Result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Winner Announcement */}
          <motion.div
            className="mb-8 text-center"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 12 }}
          >
            {winnerId ? (
              <>
                <p className="mb-1 text-sm text-slate-400">The winner is...</p>
                <h2 className="text-4xl font-extrabold">
                  {winnerId === player.id ? (
                    <span className="text-brand-blue">{player.username} 🎉</span>
                  ) : (
                    <span className="text-red-400">{opponent} 🎉</span>
                  )}
                </h2>
              </>
            ) : (
              <>
                <p className="mb-1 text-sm text-slate-400">Result</p>
                <h2 className="text-4xl font-extrabold text-amber-400">It&apos;s a tie!</h2>
              </>
            )}
          </motion.div>

          {/* Stats Comparison */}
          <div className="mb-6 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-brand-blue font-bold">{(p1Result as Record<string, unknown>).username as string}</p>
            </div>
            <div />
            <div>
              <p className="text-sm text-red-400 font-bold">{(p2Result as Record<string, unknown>).username as string}</p>
            </div>

            <StatRow
              v1={`$${((p1Result as Record<string, unknown>).final_value as number).toFixed(0)}`}
              label="Final Value"
              v2={`$${((p2Result as Record<string, unknown>).final_value as number).toFixed(0)}`}
            />
            <StatRow
              v1={`${((p1Result as Record<string, unknown>).total_return as number) > 0 ? "+" : ""}${((p1Result as Record<string, unknown>).total_return as number).toFixed(1)}%`}
              label="Return"
              v2={`${((p2Result as Record<string, unknown>).total_return as number) > 0 ? "+" : ""}${((p2Result as Record<string, unknown>).total_return as number).toFixed(1)}%`}
            />
            <StatRow
              v1={((p1Result as Record<string, unknown>).sharpe_ratio as number).toFixed(2)}
              label="Sharpe"
              v2={((p2Result as Record<string, unknown>).sharpe_ratio as number).toFixed(2)}
            />
          </div>

          {/* Chart */}
          <div className="mb-6 rounded-2xl border border-surface-lighter bg-surface-light/50 p-4">
            <PerformanceChart
              months={months}
              values={p1Values}
              values2={p2Values}
              animate={false}
              color="#3B82F6"
              color2="#EF4444"
            />
          </div>

          {/* AI Insight */}
          {aiInsight && <AiInsight text={aiInsight} />}

          {/* Actions */}
          <div className="mt-6 flex justify-center gap-4">
            <button
              onClick={() => router.push("/battle")}
              className="rounded-xl bg-brand-purple px-8 py-3 font-bold transition-all hover:bg-brand-purple/80"
            >
              Play Again
            </button>
            <button
              onClick={() => router.push("/sandbox")}
              className="rounded-xl border border-surface-lighter px-8 py-3 font-bold
                         transition-all hover:bg-surface-light"
            >
              Back to Sandbox
            </button>
          </div>
        </motion.div>
      )}
    </main>
  );
}

function StatRow({ v1, label, v2 }: { v1: string; label: string; v2: string }) {
  return (
    <>
      <p className="text-lg font-bold tabular-nums">{v1}</p>
      <p className="text-xs text-slate-500 self-center">{label}</p>
      <p className="text-lg font-bold tabular-nums">{v2}</p>
    </>
  );
}
