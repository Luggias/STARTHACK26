"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/game-store";
import { getScenarios, simulate, simulateGBM, simulateMonteCarlo, saveStrategy } from "@/lib/api";
import { ASSET_KEYS } from "@/lib/constants";
import type { ScenarioMeta, SimulationResult, GBMResult, MarketEvent } from "@/lib/types";
import PortfolioBuilder from "@/components/portfolio-builder";
import ScenarioSelector from "@/components/scenario-selector";
import PerformanceChart from "@/components/performance-chart";
import MarketEventModal from "@/components/market-event-modal";

type Mode = "historical" | "gbm";

export default function SandboxPage() {
  const allocation        = useGameStore((s) => s.allocation);
  const setAssetAllocation = useGameStore((s) => s.setAssetAllocation);
  const resetAllocation   = useGameStore((s) => s.resetAllocation);
  const unlockAsset       = useGameStore((s) => s.unlockAsset);
  const addStrategy       = useGameStore((s) => s.addStrategy);
  const token             = useGameStore((s) => s.token);

  const [mode, setMode]               = useState<Mode>("historical");
  const [scenarios, setScenarios]     = useState<ScenarioMeta[]>([]);
  const [selected, setSelected]       = useState<string | null>(null);
  const [injectEvents, setInjectEvents] = useState(true);
  const [strategyName, setStrategyName] = useState("");

  const [histResult, setHistResult]   = useState<SimulationResult | null>(null);
  const [gbmResult, setGbmResult]     = useState<GBMResult | null>(null);
  const [mcResult, setMcResult]       = useState<{ p5: number[]; p50: number[]; p95: number[] } | null>(null);

  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [saveStatus, setSaveStatus]   = useState<"idle" | "saving" | "saved">("idle");

  const [pendingEvents, setPendingEvents] = useState<MarketEvent[]>([]);
  const [currentEvent, setCurrentEvent]   = useState<MarketEvent | null>(null);

  useEffect(() => {
    getScenarios().then(setScenarios).catch(() =>
      setScenarios([
        { key: "2008_crisis",    name: "2008 Financial Crisis",   period: "Sep 2008 – Feb 2009", description: "Lehman Brothers collapse triggers global meltdown.",  lesson: "Diversification protects.", num_months: 6  },
        { key: "covid_crash",    name: "COVID Crash & Recovery",  period: "Feb 2020 – Dec 2020", description: "Markets crashed 30% in weeks, then recovered fast.",   lesson: "Stay invested.",          num_months: 11 },
        { key: "dotcom_burst",   name: "Dot-Com Bubble Burst",    period: "Mar 2000 – Mar 2001", description: "Tech stocks collapsed when internet hype ended.",     lesson: "Avoid sector concentration.",num_months: 13 },
        { key: "2022_inflation", name: "2022 Inflation Surge",    period: "Jan 2022 – Dec 2022", description: "Both stocks & bonds fell as inflation surged.",       lesson: "Inflation changes everything.", num_months: 12 },
      ])
    );
  }, []);

  function dismissEvent() {
    const rest = pendingEvents.slice(1);
    setPendingEvents(rest);
    setCurrentEvent(rest[0] ?? null);
  }

  async function handleRun() {
    const total = ASSET_KEYS.reduce((sum, k) => sum + allocation[k], 0);
    if (total !== 100) { setError(`Allocation must be 100% (currently ${total}%)`); return; }
    if (mode === "historical" && !selected) { setError("Select a scenario first."); return; }

    setLoading(true); setError(""); setHistResult(null); setGbmResult(null); setMcResult(null);

    try {
      if (mode === "historical") {
        const r = await simulate(allocation, selected!);
        setHistResult(r);
      } else {
        const [gbm, mc] = await Promise.all([
          simulateGBM(allocation, 20, undefined, injectEvents),
          simulateMonteCarlo(allocation, 20, 100),
        ]);
        setGbmResult(gbm);
        setMcResult({ p5: mc.p5, p50: mc.p50, p95: mc.p95 });
        if (injectEvents && gbm.events_triggered.length > 0) {
          setPendingEvents(gbm.events_triggered);
          setCurrentEvent(gbm.events_triggered[0]);
        }
      }
    } catch {
      setError("Simulation failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    const r = mode === "historical" ? histResult : gbmResult;
    if (!r || !token) return;
    setSaveStatus("saving");
    try {
      const name = strategyName.trim() || `Strategy ${new Date().toLocaleDateString()}`;
      const resp = await saveStrategy({
        name,
        allocation,
        scenario_key: mode === "historical" ? (selected ?? "historical") : "gbm_20y",
        result: r as Partial<SimulationResult>,
      });
      if (resp.unlocked_next) unlockAsset(resp.unlocked_next);
      addStrategy({ name, allocation, scenario_key: selected ?? "gbm_20y", result: r as Partial<SimulationResult> });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch {
      setSaveStatus("idle");
    }
  }

  const result      = mode === "historical" ? histResult : gbmResult;
  const values      = result ? ("values" in result ? result.values : null) : null;
  const months      = result ? ("months" in result ? result.months : null) : null;
  const hasResult   = !!(result && values && months);

  return (
    <div className="min-h-screen px-6 py-10">
      <MarketEventModal event={currentEvent} onDismiss={dismissEvent} />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-headline text-white">Sandbox</h1>
        <p className="mt-1 text-sm text-white/35">Build and test your portfolio strategies</p>
      </motion.div>

      {/* Strategy name */}
      <div className="mt-8 max-w-xs">
        <input
          type="text"
          placeholder="Strategy name…"
          value={strategyName}
          onChange={(e) => setStrategyName(e.target.value)}
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-white/15 focus:bg-white/[0.06]"
        />
      </div>

      {/* Mode toggle */}
      <div className="mt-4 inline-flex rounded-xl bg-white/[0.04] p-1 gap-0.5">
        {(["historical", "gbm"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-lg px-5 py-2 text-sm font-medium transition-all ${
              mode === m ? "bg-white/[0.08] text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            {m === "historical" ? "Historical" : "GBM · 20 years"}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Portfolio builder */}
        <div className="glass rounded-2xl p-6">
          <PortfolioBuilder
            allocation={allocation}
            onAssetChange={setAssetAllocation}
            onReset={resetAllocation}
          />
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-4">
          {mode === "historical" && (
            <div className="glass rounded-2xl p-5">
              <p className="mb-3 text-sm font-medium text-white/70">Select scenario</p>
              <ScenarioSelector scenarios={scenarios} selected={selected} onSelect={setSelected} />
            </div>
          )}

          {mode === "gbm" && (
            <div className="glass rounded-2xl p-5">
              <p className="mb-3 text-sm font-medium text-white/70">Options</p>
              <label className="flex cursor-pointer items-center gap-3">
                <div
                  onClick={() => setInjectEvents(!injectEvents)}
                  className={`relative h-6 w-10 rounded-full transition-colors ${injectEvents ? "bg-[#0071e3]" : "bg-white/10"}`}
                >
                  <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${injectEvents ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
                <span className="text-sm text-white/60">Market events</span>
              </label>
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleRun}
            disabled={loading || (mode === "historical" && !selected)}
            className="rounded-full bg-[#0071e3] py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#0077ed] disabled:opacity-30"
          >
            {loading ? "Simulating…" : "Run Simulation"}
          </motion.button>

          {error && <p className="text-xs text-[#ff453a]">{error}</p>}
        </div>
      </div>

      {/* Results */}
      <AnimatePresence>
        {hasResult && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8"
          >
            {/* Results header */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Results</h2>
              <button
                onClick={handleSave}
                disabled={saveStatus !== "idle"}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                  saveStatus === "saved"
                    ? "bg-[#30d158]/10 text-[#30d158]"
                    : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white disabled:opacity-40"
                }`}
              >
                {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved" : "Save strategy"}
              </button>
            </div>

            {/* Metrics */}
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Final Value" value={`$${result!.final_value.toFixed(0)}`} positive={result!.final_value >= 10000} />
              <Metric label="Total Return" value={`${result!.total_return >= 0 ? "+" : ""}${result!.total_return.toFixed(1)}%`} positive={result!.total_return >= 0} />
              {"sharpe_ratio" in result! && <Metric label="Sharpe" value={(result as SimulationResult).sharpe_ratio.toFixed(2)} positive={(result as SimulationResult).sharpe_ratio >= 0} />}
              {"max_drawdown" in result! && <Metric label="Max Drawdown" value={`-${(result as SimulationResult).max_drawdown.toFixed(1)}%`} positive={(result as SimulationResult).max_drawdown < 10} />}
            </div>

            {/* Chart */}
            <div className="glass rounded-2xl p-5">
              <PerformanceChart months={months!} values={values!} animate color="#2997ff" />
              {mcResult && (
                <div className="mt-3 flex gap-5 border-t border-white/[0.06] pt-3">
                  <MCBand label="5th pct" value={mcResult.p5.at(-1)} color="#ff453a" />
                  <MCBand label="Median"  value={mcResult.p50.at(-1)} color="#2997ff" />
                  <MCBand label="95th pct" value={mcResult.p95.at(-1)} color="#30d158" />
                </div>
              )}
            </div>

            {/* Events */}
            {"events_triggered" in result! && (result as GBMResult).events_triggered.length > 0 && (
              <div className="mt-4 glass rounded-2xl p-5">
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[#ff9f0a]">
                  Market Events
                </p>
                <div className="space-y-3">
                  {(result as GBMResult).events_triggered.map((ev) => (
                    <div key={ev.key} className="flex items-start gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#ff9f0a]" />
                      <div>
                        <p className="text-sm font-medium text-white">{ev.headline}</p>
                        <p className="text-xs text-white/30">at {Math.round(ev.step_frac * 100)}% of projection</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Asset contributions */}
            {"asset_contributions" in result! && (
              <div className="mt-4 glass rounded-2xl p-5">
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">Asset Contributions</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries((result as SimulationResult).asset_contributions).map(([a, pct]) => (
                    <span key={a} className="rounded-full bg-white/[0.06] px-3 py-1 text-xs">
                      <span className="capitalize text-white/50">{a}</span>{" "}
                      <span className={pct >= 0 ? "text-[#30d158]" : "text-[#ff453a]"}>
                        {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Metric({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div className="glass rounded-xl p-4">
      <p className="text-xs text-white/30">{label}</p>
      <p className={`mt-1 font-mono-data text-xl font-bold ${positive ? "text-[#30d158]" : "text-[#ff453a]"}`}>
        {value}
      </p>
    </div>
  );
}

function MCBand({ label, value, color }: { label: string; value?: number; color: string }) {
  return (
    <div>
      <p className="text-[10px] text-white/30">{label}</p>
      <p className="font-mono-data text-sm font-semibold" style={{ color }}>
        ${value?.toFixed(0) ?? "—"}
      </p>
    </div>
  );
}
