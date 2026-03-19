"use client";

import type { Strategy } from "@/lib/types";
import Sparkline from "./sparkline";

export default function StrategyCard({ strategy }: { strategy: Strategy }) {
  const r           = strategy.result ?? {};
  const ret         = typeof r.total_return === "number" ? r.total_return : null;
  const sharpe      = typeof r.sharpe_ratio === "number" ? r.sharpe_ratio : null;
  const values      = Array.isArray(r.values) ? r.values : [];
  const isPositive  = ret === null ? true : ret >= 0;

  return (
    <div className="glass rounded-2xl p-5 transition-all hover:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{strategy.name}</p>
          <p className="mt-0.5 text-xs capitalize text-white/30">
            {strategy.scenario_key?.replace(/_/g, " ") ?? "simulation"}
          </p>
        </div>
        {values.length > 1 && (
          <div className="flex-shrink-0 pt-1">
            <Sparkline values={values.slice(0, 40)} color={isPositive ? "#30d158" : "#ff453a"} width={72} height={28} />
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-5">
        {ret !== null && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/25">Return</p>
            <p className={`font-mono-data text-lg font-bold ${isPositive ? "text-[#30d158]" : "text-[#ff453a]"}`}>
              {isPositive ? "+" : ""}{ret.toFixed(1)}%
            </p>
          </div>
        )}
        {sharpe !== null && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/25">Sharpe</p>
            <p className="font-mono-data text-lg font-bold text-white/70">{sharpe.toFixed(2)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
