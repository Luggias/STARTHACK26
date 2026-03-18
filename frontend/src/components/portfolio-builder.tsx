"use client";

import { ASSET_KEYS, ASSET_INFO } from "@/lib/constants";
import type { Allocation } from "@/lib/types";
import PortfolioSlider from "./portfolio-slider";

interface PortfolioBuilderProps {
  allocation: Allocation;
  onAssetChange: (asset: keyof Allocation, value: number) => void;
  onReset: () => void;
}

export default function PortfolioBuilder({
  allocation,
  onAssetChange,
  onReset,
}: PortfolioBuilderProps) {
  const total = ASSET_KEYS.reduce((sum, k) => sum + allocation[k], 0);

  // Compute pie chart as conic gradient
  const segments: string[] = [];
  let cumulative = 0;
  for (const key of ASSET_KEYS) {
    const pct = allocation[key];
    if (pct > 0) {
      const start = cumulative;
      const end = cumulative + pct;
      segments.push(`${ASSET_INFO[key].color} ${start}% ${end}%`);
      cumulative = end;
    }
  }
  const conicGradient =
    segments.length > 0
      ? `conic-gradient(${segments.join(", ")})`
      : "conic-gradient(#334155 0% 100%)";

  return (
    <div className="rounded-2xl border border-surface-lighter bg-surface-light/50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Your Portfolio</h2>
        <button
          onClick={onReset}
          className="text-xs text-slate-500 transition-colors hover:text-slate-300"
        >
          Reset
        </button>
      </div>

      {/* Pie chart */}
      <div className="mx-auto mb-6 flex justify-center">
        <div
          className="relative h-32 w-32 rounded-full"
          style={{ background: conicGradient }}
        >
          <div className="absolute inset-3 flex items-center justify-center rounded-full bg-surface-light">
            <span className="text-sm font-bold tabular-nums">
              {total}%
            </span>
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div className="flex flex-col gap-4">
        {ASSET_KEYS.map((key) => (
          <PortfolioSlider
            key={key}
            assetKey={key}
            value={allocation[key]}
            onChange={(v) => onAssetChange(key, v)}
          />
        ))}
      </div>

      {total !== 100 && (
        <p className="mt-3 text-center text-xs text-amber-400">
          Total must equal 100% (currently {total}%)
        </p>
      )}
    </div>
  );
}
