"use client";

import { useEffect, useState, useRef } from "react";
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
  const allocation = useGameStore((s) => s.allocation);
  const setAssetAllocation = useGameStore((s) => s.setAssetAllocation);
  const resetAllocation = useGameStore((s) => s.resetAllocation);
  const unlockAsset = useGameStore((s) => s.unlockAsset);
  const addStrategy = useGameStore((s) => s.addStrategy);
  const user = useGameStore((s) => s.user);
  const token = useGameStore((s) => s.token);

  const [mode, setMode] = useState<Mode>("historical");
  const [scenarios, setScenarios] = useState<ScenarioMeta[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [injectEvents, setInjectEvents] = useState(true);
  const [strategyName, setStrategyName] = useState("");

  const [historicalResult, setHistoricalResult] = useState<SimulationResult | null>(null);
  const [gbmResult, setGbmResult] = useState<GBMResult | null>(null);
  const [mcResult, setMcResult] = useState<{ p5: number[]; p50: number[]; p95: number[] } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Market event modal
  const [pendingEvents, setPendingEvents] = useState<MarketEvent[]>([]);
  const [currentEvent, setCurrentEvent] = useState<MarketEvent | null>(null);

  useEffect(() => {
    getScenarios()
      .then(setScenarios)
      .catch(() => {
        setScenarios([
          { key: "2008_crisis", name: "2008 Financial Crisis", period: "Sep 2008 – Feb 2009", description: "The collapse of Lehman Brothers triggered a global financial meltdown.", lesson: "Diversification protects.", num_months: 6 },
          { key: "covid_crash", name: "COVID Crash & Recovery", period: "Feb 2020 – Dec 2020", description: "Markets crashed 30% in weeks, then recovered spectacularly.", lesson: "Stay invested.", num_months: 11 },
          { key: "dotcom_burst", name: "Dot-Com Bubble Burst", period: "Mar 2000 – Mar 2001", description: "Tech stocks crashed when the internet hype ended.", lesson: "Don't chase hype.", num_months: 13 },
          { key: "2022_inflation", name: "2022 Inflation Surge", period: "Jan 2022 – Dec 2022", description: "Both stocks AND bonds fell as inflation surged.", lesson: "Inflation changes everything.", num_months: 12 },
        ]);
      });
  }, []);

  function dismissEvent() {
    const remaining = pendingEvents.slice(1);
    setPendingEvents(remaining);
    setCurrentEvent(remaining.length > 0 ? remaining[0] : null);
  }

  async function handleSimulate() {
    const total = ASSET_KEYS.reduce((sum, k) => sum + allocation[k], 0);
    if (total !== 100) {
      setError(`Allocation must equal 100% (currently ${total}%)`);
      return;
    }

    setLoading(true);
    setError("");
    setHistoricalResult(null);
    setGbmResult(null);
    setMcResult(null);

    try {
      if (mode === "historical") {
        if (!selectedScenario) {
          setError("Please select a scenario");
          setLoading(false);
          return;
        }
        const result = await simulate(allocation, selectedScenario);
        setHistoricalResult(result);
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
    const name = strategyName.trim() || `Strategy ${Date.now()}`;
    const result = mode === "historical" ? historicalResult : gbmResult;
    if (!result) return;
    if (!token) {
      setError("Log in to save strategies");
      return;
    }

    setSaveStatus("saving");
    try {
      const resp = await saveStrategy({
        name,
        allocation,
        scenario_key: mode === "historical" ? (selectedScenario ?? "gbm") : "gbm_20y",
        result: result as Partial<SimulationResult>,
      });
      if (resp.unlocked_next) unlockAsset(resp.unlocked_next);
      addStrategy({ name, allocation, scenario_key: selectedScenario ?? "gbm_20y", result: result as Partial<SimulationResult> });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("idle");
      setError("Failed to save strategy");
    }
  }

  const displayResult = mode === "historical" ? historicalResult : gbmResult;
  const displayValues = displayResult ? ("values" in displayResult ? displayResult.values : null) : null;
  const displayMonths = displayResult ? ("months" in displayResult ? displayResult.months : null) : null;

  return (
    <div className="min-h-screen p-6 pt-8">
      <MarketEventModal event={currentEvent} onDismiss={dismissEvent} />

      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Sandbox</h1>
          <p className="text-sm text-slate-500 mt-1">Build, test, and save your strategies</p>
        </div>
      </div>

      {/* Strategy name */}
      <div className="mb-6 max-w-sm">
        <input
          type="text"
          placeholder="Strategy name..."
          value={strategyName}
          onChange={(e) => setStrategyName(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-[#00d4ff]/40 focus:ring-1 focus:ring-[#00d4ff]/20 transition-all"
        />
      </div>

      {/* Mode toggle */}
      <div className="mb-6 flex gap-1 rounded-xl bg-[#0f0f1a] border border-white/5 p-1 w-fit">
        {(["historical", "gbm"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              mode === m
                ? "bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {m === "historical" ? "Historical Scenario" : "GBM Simulation (20yr)"}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Portfolio builder */}
        <div>
          <PortfolioBuilder
            allocation={allocation}
            onAssetChange={setAssetAllocation}
            onReset={resetAllocation}
          />
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-4">
          {mode === "historical" && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-slate-300">Pick a Scenario</h2>
              <ScenarioSelector
                scenarios={scenarios}
                selected={selectedScenario}
                onSelect={setSelectedScenario}
              />
            </div>
          )}

          {mode === "gbm" && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={injectEvents}
                onChange={(e) => setInjectEvents(e.target.checked)}
                className="h-4 w-4 rounded accent-[#00d4ff]"
              />
              <span className="text-sm text-slate-300">Inject market events</span>
            </label>
          )}

          <button
            onClick={handleSimulate}
            disabled={loading || (mode === "historical" && !selectedScenario)}
            className="rounded-xl bg-[#00d4ff]/10 border border-[#00d4ff]/20 py-3 text-sm font-bold text-[#00d4ff] transition-all hover:bg-[#00d4ff]/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Simulating..." : "Run Simulation"}
          </button>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </div>

      {/* Results */}
      <AnimatePresence>
        {displayResult && displayValues && displayMonths && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10"
          >
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-white">Results</h2>
              <button
                onClick={handleSave}
                disabled={saveStatus !== "idle"}
                className="rounded-xl border border-white/10 bg-[#0f0f1a] px-5 py-2 text-sm font-semibold text-slate-300 hover:border-[#00d4ff]/20 hover:text-[#00d4ff] transition-all disabled:opacity-50"
              >
                {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "✓ Saved!" : "Save Strategy"}
              </button>
            </div>

            {/* Metrics */}
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <MetricCard
                label="Final Value"
                value={`$${displayResult.final_value.toFixed(0)}`}
                positive={displayResult.final_value >= 10000}
              />
              <MetricCard
                label="Total Return"
                value={`${displayResult.total_return > 0 ? "+" : ""}${displayResult.total_return.toFixed(1)}%`}
                positive={displayResult.total_return >= 0}
              />
              {"sharpe_ratio" in displayResult && (
                <MetricCard
                  label="Sharpe Ratio"
                  value={(displayResult as SimulationResult).sharpe_ratio.toFixed(2)}
                  positive={(displayResult as SimulationResult).sharpe_ratio >= 0}
                />
              )}
              {"max_drawdown" in displayResult && (
                <MetricCard
                  label="Max Drawdown"
                  value={`-${(displayResult as SimulationResult).max_drawdown.toFixed(1)}%`}
                  positive={(displayResult as SimulationResult).max_drawdown < 10}
                />
              )}
            </div>

            {/* Chart */}
            <div className="rounded-xl border border-white/5 bg-[#0f0f1a] p-4">
              <PerformanceChart
                months={displayMonths}
                values={displayValues}
                animate
                color="#00d4ff"
              />
              {/* Monte Carlo bands (simplified display) */}
              {mcResult && (
                <div className="mt-3 flex gap-4 text-xs font-mono-data">
                  <span className="text-slate-600">p5: <span className="text-red-400">${mcResult.p5[mcResult.p5.length - 1]?.toFixed(0)}</span></span>
                  <span className="text-slate-600">median: <span className="text-[#00d4ff]">${mcResult.p50[mcResult.p50.length - 1]?.toFixed(0)}</span></span>
                  <span className="text-slate-600">p95: <span className="text-green-400">${mcResult.p95[mcResult.p95.length - 1]?.toFixed(0)}</span></span>
                </div>
              )}
            </div>

            {/* GBM events triggered */}
            {"events_triggered" in displayResult && (displayResult as GBMResult).events_triggered.length > 0 && (
              <div className="mt-6 rounded-xl border border-yellow-400/10 bg-yellow-400/5 p-4">
                <p className="text-xs uppercase tracking-wider text-yellow-400 mb-3">Market Events That Occurred</p>
                <div className="space-y-2">
                  {(displayResult as GBMResult).events_triggered.map((ev) => (
                    <div key={ev.key} className="flex items-start gap-3">
                      <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-yellow-400" />
                      <div>
                        <p className="text-sm text-white">{ev.headline}</p>
                        <p className="text-xs text-slate-500">at {Math.round(ev.step_frac * 100)}% of simulation</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Asset contributions (historical only) */}
            {"asset_contributions" in displayResult && (
              <div className="mt-6 rounded-xl border border-white/5 bg-[#0f0f1a] p-4">
                <p className="mb-3 text-sm font-semibold text-slate-300">Asset Contributions</p>
                <div className="flex flex-wrap gap-3">
                  {Object.entries((displayResult as SimulationResult).asset_contributions).map(([asset, pct]) => (
                    <div key={asset} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs">
                      <span className="capitalize text-slate-300">{asset}</span>:{" "}
                      <span className={pct >= 0 ? "text-green-400" : "text-red-400"}>
                        {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
                      </span>
                    </div>
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

function MetricCard({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#0f0f1a] p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 font-mono-data text-xl font-bold ${positive ? "text-green-400" : "text-red-400"}`}>
        {value}
      </p>
    </div>
  );
}
