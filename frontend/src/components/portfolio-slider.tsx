"use client";

import type { AssetKey } from "@/lib/constants";
import { ASSET_INFO } from "@/lib/constants";

interface PortfolioSliderProps {
  assetKey: AssetKey;
  value: number;
  onChange: (value: number) => void;
}

export default function PortfolioSlider({
  assetKey,
  value,
  onChange,
}: PortfolioSliderProps) {
  const asset = ASSET_INFO[assetKey];

  return (
    <div className="flex items-center gap-3">
      <span className="w-6 text-center text-lg">{asset.icon}</span>
      <span className="w-16 text-sm font-medium">{asset.name}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
        style={{
          accentColor: asset.color,
        }}
      />
      <span
        className="w-12 text-right text-sm font-bold tabular-nums"
        style={{ color: asset.color }}
      >
        {value}%
      </span>
    </div>
  );
}
