"use client";

import type { Strategy } from "@/lib/types";
import Sparkline from "./sparkline";

interface StrategyCardProps {
  strategy: Strategy;
}

export default function StrategyCard({ strategy }: StrategyCardProps) {
  const result = strategy.result ?? {};
  const totalReturn = typeof result.total_return === "number" ? result.total_return : null;
  const sharpe = typeof result.sharpe_ratio === "number" ? result.sharpe_ratio : null;
  const values = Array.isArray(result.values) ? result.values : [];
  const isPositive = totalReturn !== null ? totalReturn >= 0 : true;

  return (
    <div className="rounded-xl border border-white/5 bg-[#0f0f1a] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{strategy.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{strategy.scenario_key?.replace(/_/g, " ") ?? "GBM"}</p>
        </div>
        {values.length > 1 && (
          <Sparkline values={values.slice(0, 30)} color="auto" />
        )}
      </div>

      <div className="mt-3 flex gap-4">
        {totalReturn !== null && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-600">Return</p>
            <p className={`font-mono-data text-sm font-bold ${isPositive ? "text-green-400" : "text-red-400"}`}>
              {isPositive ? "+" : ""}{totalReturn.toFixed(1)}%
            </p>
          </div>
        )}
        {sharpe !== null && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-600">Sharpe</p>
            <p className="font-mono-data text-sm font-bold text-slate-300">{sharpe.toFixed(2)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
