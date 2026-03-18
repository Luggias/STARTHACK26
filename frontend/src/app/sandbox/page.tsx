"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/game-store";
import { getScenarios, simulate } from "@/lib/api";
import { ASSET_KEYS } from "@/lib/constants";
import type { ScenarioMeta, SimulationResult } from "@/lib/types";
import AssetCard from "@/components/asset-card";
import PortfolioBuilder from "@/components/portfolio-builder";
import ScenarioSelector from "@/components/scenario-selector";
import PerformanceChart from "@/components/performance-chart";

export default function SandboxPage() {
  const router = useRouter();
  const player = useGameStore((s) => s.player);
  const allocation = useGameStore((s) => s.allocation);
  const setAssetAllocation = useGameStore((s) => s.setAssetAllocation);
  const resetAllocation = useGameStore((s) => s.resetAllocation);

  const [scenarios, setScenarios] = useState<ScenarioMeta[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load scenarios on mount
  useEffect(() => {
    getScenarios()
      .then(setScenarios)
      .catch(() => {
        // Fallback: use hardcoded scenario metadata if backend is unavailable
        setScenarios([
          { key: "2008_crisis", name: "2008 Financial Crisis", period: "Sep 2008 – Feb 2009", description: "The collapse of Lehman Brothers triggered a global financial meltdown.", lesson: "Diversification protects.", num_months: 6 },
          { key: "covid_crash", name: "COVID Crash & Recovery", period: "Feb 2020 – Dec 2020", description: "Markets crashed 30% in weeks, then recovered spectacularly.", lesson: "Stay invested.", num_months: 11 },
          { key: "dotcom_burst", name: "Dot-Com Bubble Burst", period: "Mar 2000 – Mar 2001", description: "Tech stocks crashed when the internet hype ended.", lesson: "Don't chase hype.", num_months: 13 },
          { key: "2022_inflation", name: "2022 Inflation Surge", period: "Jan 2022 – Dec 2022", description: "Both stocks AND bonds fell as inflation surged.", lesson: "Inflation changes everything.", num_months: 12 },
        ]);
      });
  }, []);

  async function handleSimulate() {
    if (!selectedScenario) {
      setError("Please select a historical scenario");
      return;
    }

    const total = ASSET_KEYS.reduce((sum, k) => sum + allocation[k], 0);
    if (total !== 100) {
      setError(`Allocation must equal 100% (currently ${total}%)`);
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const sim = await simulate(allocation, selectedScenario);
      setResult(sim);
    } catch (e) {
      setError("Simulation failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  // Redirect to landing if no player
  if (!player) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-slate-400">Please enter your username first.</p>
          <button
            onClick={() => router.push("/")}
            className="rounded-lg bg-brand-blue px-6 py-2 font-bold"
          >
            Go to Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-extrabold">Sandbox Mode</h1>
          <p className="text-sm text-slate-400">
            Welcome, <span className="text-brand-blue">{player.username}</span> — explore assets and build your portfolio
          </p>
        </div>
        <button
          onClick={() => router.push("/battle")}
          className="rounded-xl bg-brand-purple px-6 py-2.5 text-sm font-bold transition-all hover:bg-brand-purple/80"
        >
          Go to Battle
        </button>
      </motion.div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left: Asset Classes */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="mb-4 text-lg font-bold">Asset Classes</h2>
          <p className="mb-4 text-xs text-slate-500">
            Tap each card to learn more. Risk dots: more = riskier.
          </p>
          <div className="flex flex-col gap-3">
            {ASSET_KEYS.map((key) => (
              <AssetCard key={key} assetKey={key} />
            ))}
          </div>
        </motion.div>

        {/* Right: Portfolio Builder */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col gap-6"
        >
          <PortfolioBuilder
            allocation={allocation}
            onAssetChange={setAssetAllocation}
            onReset={resetAllocation}
          />

          {/* Scenario Selector */}
          <div>
            <h2 className="mb-3 text-lg font-bold">Pick a Scenario</h2>
            <p className="mb-3 text-xs text-slate-500">
              Choose a real historical period to test your portfolio against.
            </p>
            <ScenarioSelector
              scenarios={scenarios}
              selected={selectedScenario}
              onSelect={setSelectedScenario}
            />
          </div>

          {/* Simulate Button */}
          <button
            onClick={handleSimulate}
            disabled={loading || !selectedScenario}
            className="w-full rounded-xl bg-brand-blue py-3.5 text-lg font-bold
                       transition-all hover:bg-brand-blue/90 hover:shadow-lg hover:shadow-brand-blue/25
                       disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Simulating..." : "Test My Portfolio"}
          </button>

          {error && (
            <p className="text-center text-sm text-red-400">{error}</p>
          )}
        </motion.div>
      </div>

      {/* Results */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-10"
        >
          <h2 className="mb-4 text-xl font-extrabold">Results</h2>

          {/* Metrics */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricCard
              label="Final Value"
              value={`$${result.final_value.toFixed(0)}`}
              sub="Started at $100"
              positive={result.final_value >= 100}
            />
            <MetricCard
              label="Total Return"
              value={`${result.total_return > 0 ? "+" : ""}${result.total_return.toFixed(1)}%`}
              positive={result.total_return >= 0}
            />
            <MetricCard
              label="Sharpe Ratio"
              value={result.sharpe_ratio.toFixed(2)}
              sub="Risk-adjusted return"
              positive={result.sharpe_ratio >= 0}
            />
            <MetricCard
              label="Max Drawdown"
              value={`-${result.max_drawdown.toFixed(1)}%`}
              sub="Largest peak-to-trough drop"
              positive={result.max_drawdown < 10}
            />
          </div>

          {/* Chart */}
          <div className="rounded-2xl border border-surface-lighter bg-surface-light/50 p-4">
            <PerformanceChart
              months={result.months}
              values={result.values}
              animate
              color="#3B82F6"
            />
          </div>

          {/* Asset Contributions */}
          <div className="mt-6 rounded-xl border border-surface-lighter bg-surface-light/30 p-4">
            <h3 className="mb-3 text-sm font-bold">Asset Contributions</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(result.asset_contributions).map(([asset, pct]) => (
                <div
                  key={asset}
                  className="rounded-lg bg-surface-light px-3 py-1.5 text-xs"
                >
                  <span className="capitalize">{asset}</span>:{" "}
                  <span
                    className={
                      pct >= 0 ? "text-green-400" : "text-red-400"
                    }
                  >
                    {pct > 0 ? "+" : ""}
                    {pct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </main>
  );
}

/** Small metric display card */
function MetricCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive: boolean;
}) {
  return (
    <div className="rounded-xl border border-surface-lighter bg-surface-light/50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-1 text-xl font-extrabold tabular-nums ${
          positive ? "text-green-400" : "text-red-400"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-600">{sub}</p>}
    </div>
  );
}
