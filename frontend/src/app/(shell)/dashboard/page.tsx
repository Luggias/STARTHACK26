"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/store/game-store";
import { getTop3Strategies, getLongtermHistory } from "@/lib/api";
import type { Strategy } from "@/lib/types";
import StrategyCard from "@/components/strategy-card";
import Sparkline from "@/components/sparkline";

type Tab = "strategies" | "portfolio";

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("strategies");
  const [top3, setTop3] = useState<Strategy[]>([]);
  const [history, setHistory] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useGameStore((s) => s.user);
  const token = useGameStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    async function load() {
      setLoading(true);
      try {
        const [strats, hist] = await Promise.allSettled([
          getTop3Strategies(),
          getLongtermHistory(),
        ]);
        if (strats.status === "fulfilled") setTop3(strats.value);
        if (hist.status === "fulfilled" && hist.value) setHistory(hist.value.values);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const TABS: { id: Tab; label: string }[] = [
    { id: "strategies", label: "Top Strategies" },
    { id: "portfolio", label: "Long-term Portfolio" },
  ];

  return (
    <div className="min-h-screen p-6 pt-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Your performance at a glance</p>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-xl bg-[#0f0f1a] border border-white/5 p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-600 text-sm">Loading...</div>
      ) : (
        <>
          {tab === "strategies" && (
            <div className="space-y-4 max-w-2xl">
              {top3.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-[#0f0f1a] p-8 text-center">
                  <p className="text-slate-500">No strategies saved yet.</p>
                  <p className="text-xs text-slate-600 mt-1">Run a simulation in Sandbox and save it!</p>
                </div>
              ) : (
                top3.map((s, i) => <StrategyCard key={s.id ?? i} strategy={s} />)
              )}
            </div>
          )}

          {tab === "portfolio" && (
            <div className="max-w-2xl">
              {history.length > 1 ? (
                <div className="rounded-xl border border-white/5 bg-[#0f0f1a] p-6">
                  <p className="text-xs uppercase tracking-wider text-slate-600 mb-4">20-Year Projection</p>
                  <Sparkline values={history} width={600} height={120} color="#00d4ff" />
                  <div className="mt-4 flex justify-between text-xs font-mono-data text-slate-500">
                    <span>Start</span>
                    <span>20 years</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-[#0f0f1a] p-8 text-center">
                  <p className="text-slate-500">No long-term portfolio found.</p>
                  <p className="text-xs text-slate-600 mt-1">Start one in the Sandbox.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
