"use client";

import type { LongtermPortfolio } from "@/lib/types";
import { ASSET_INFO } from "@/lib/constants";
import type { AssetKey } from "@/lib/constants";

interface LongtermSummaryCardProps {
  portfolio: LongtermPortfolio;
}

const ASSET_COLORS: Record<string, string> = {
  stocks: "#3B82F6",
  bonds: "#10B981",
  gold: "#F59E0B",
  cash: "#6B7280",
  crypto: "#8B5CF6",
};

export default function LongtermSummaryCard({ portfolio }: LongtermSummaryCardProps) {
  const currentValue = portfolio.current_value ?? portfolio.initial_amount_chf;
  const currentReturn = portfolio.current_return ?? 0;
  const isPositive = currentReturn >= 0;

  // Build donut chart data
  const alloc = portfolio.allocation as unknown as Record<string, number>;
  const total = Object.values(alloc).reduce((a, b) => a + b, 0) || 100;
  let cumAngle = -90;
  const slices: { asset: string; startAngle: number; endAngle: number; color: string }[] = [];
  for (const [asset, pct] of Object.entries(alloc)) {
    if (pct <= 0) continue;
    const sweep = (pct / total) * 360;
    slices.push({
      asset,
      startAngle: cumAngle,
      endAngle: cumAngle + sweep,
      color: ASSET_COLORS[asset] ?? "#888",
    });
    cumAngle += sweep;
  }

  function polarToXY(angleDeg: number, r: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: 50 + r * Math.cos(rad), y: 50 + r * Math.sin(rad) };
  }

  function arcPath(startAngle: number, endAngle: number, r = 36, innerR = 22) {
    const s = polarToXY(startAngle, r);
    const e = polarToXY(endAngle, r);
    const si = polarToXY(startAngle, innerR);
    const ei = polarToXY(endAngle, innerR);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y} L ${ei.x} ${ei.y} A ${innerR} ${innerR} 0 ${largeArc} 0 ${si.x} ${si.y} Z`;
  }

  return (
    <div className="rounded-xl border border-white/5 bg-[#0f0f1a] p-6">
      <p className="text-xs uppercase tracking-wider text-slate-600 mb-4">Long-term Portfolio</p>

      <div className="flex items-center gap-6">
        {/* Donut chart */}
        <svg width="100" height="100" viewBox="0 0 100 100">
          {slices.map((slice) => (
            <path
              key={slice.asset}
              d={arcPath(slice.startAngle, slice.endAngle)}
              fill={slice.color}
              opacity={0.85}
            />
          ))}
          <circle cx="50" cy="50" r="18" fill="#0f0f1a" />
        </svg>

        {/* Stats */}
        <div className="flex-1">
          <p className="font-mono-data text-2xl font-bold text-white">
            {currentValue.toLocaleString("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 })}
          </p>
          <p className={`font-mono-data text-sm font-semibold mt-1 ${isPositive ? "text-green-400" : "text-red-400"}`}>
            {isPositive ? "+" : ""}{currentReturn.toFixed(2)}% since start
          </p>
          <p className="text-xs text-slate-600 mt-2">
            Started with {portfolio.initial_amount_chf.toLocaleString("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(alloc).filter(([, v]) => v > 0).map(([asset, pct]) => (
          <span key={asset} className="flex items-center gap-1 text-xs text-slate-400">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: ASSET_COLORS[asset] }} />
            {ASSET_INFO[asset as AssetKey]?.name ?? asset} {pct}%
          </span>
        ))}
      </div>
    </div>
  );
}
