"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/game-store";
import { getTop3Strategies, getLongtermHistory } from "@/lib/api";
import type { Strategy } from "@/lib/types";
import StrategyCard from "@/components/strategy-card";
import Sparkline from "@/components/sparkline";

type Tab = "strategies" | "portfolio";

export default function DashboardPage() {
  const [tab, setTab]       = useState<Tab>("strategies");
  const [top3, setTop3]     = useState<Strategy[]>([]);
  const [history, setHistory] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const token = useGameStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      const [s, h] = await Promise.allSettled([getTop3Strategies(), getLongtermHistory()]);
      if (s.status === "fulfilled") setTop3(s.value);
      if (h.status === "fulfilled" && h.value) setHistory(h.value.values);
      setLoading(false);
    })();
  }, [token]);

  const TABS: { id: Tab; label: string }[] = [
    { id: "strategies", label: "Top Strategies" },
    { id: "portfolio",  label: "Projection" },
  ];

  return (
    <div className="min-h-screen px-6 py-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-headline text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-white/35">Your performance at a glance</p>
      </motion.div>

      {/* Tab bar */}
      <div className="mt-8 mb-6 inline-flex rounded-xl bg-white/[0.04] p-1 gap-0.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-5 py-2 text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-white/[0.08] text-white"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-white/30">Loading…</div>
      ) : (
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {tab === "strategies" && (
            <div className="max-w-2xl space-y-3">
              {top3.length === 0 ? (
                <EmptyState
                  title="No strategies yet"
                  body="Run a simulation in Sandbox and save it to see it here."
                />
              ) : (
                top3.map((s, i) => <StrategyCard key={s.id ?? i} strategy={s} />)
              )}
            </div>
          )}

          {tab === "portfolio" && (
            <div className="max-w-2xl">
              {history.length > 1 ? (
                <div className="glass rounded-2xl p-6">
                  <p className="mb-1 text-sm font-semibold text-white">20-Year Projection</p>
                  <p className="mb-5 text-xs text-white/30">Median GBM path based on your allocation</p>
                  <Sparkline values={history} width={560} height={140} color="#2997ff" />
                  <div className="mt-3 flex justify-between text-xs font-mono-data text-white/25">
                    <span>Today</span>
                    <span>+20 years</span>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No portfolio yet"
                  body="Start a long-term portfolio in the Sandbox."
                />
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass rounded-2xl p-10 text-center">
      <p className="text-sm font-medium text-white/50">{title}</p>
      <p className="mt-1 text-xs text-white/25">{body}</p>
    </div>
  );
}
