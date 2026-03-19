"use client";

import type { LongtermPortfolio } from "@/lib/types";
import { ASSET_INFO } from "@/lib/constants";
import type { AssetKey } from "@/lib/constants";

const ASSET_COLORS: Record<string, string> = {
  stocks: "#2997ff",
  bonds:  "#30d158",
  gold:   "#ff9f0a",
  cash:   "#86868b",
  crypto: "#bf5af2",
};

function polarToXY(deg: number, r: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: 50 + r * Math.cos(rad), y: 50 + r * Math.sin(rad) };
}

function arcPath(sa: number, ea: number, r = 38, ir = 26) {
  const s  = polarToXY(sa, r);
  const e  = polarToXY(ea, r);
  const si = polarToXY(sa, ir);
  const ei = polarToXY(ea, ir);
  const lg = ea - sa > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${lg} 1 ${e.x} ${e.y} L ${ei.x} ${ei.y} A ${ir} ${ir} 0 ${lg} 0 ${si.x} ${si.y} Z`;
}

export default function LongtermSummaryCard({ portfolio }: { portfolio: LongtermPortfolio }) {
  const cur       = portfolio.current_value ?? portfolio.initial_amount_chf;
  const ret       = portfolio.current_return ?? 0;
  const isPos     = ret >= 0;
  const alloc     = portfolio.allocation as unknown as Record<string, number>;
  const total     = Object.values(alloc).reduce((a, b) => a + b, 0) || 100;

  let cumAngle = -90;
  const slices = Object.entries(alloc)
    .filter(([, v]) => v > 0)
    .map(([asset, pct]) => {
      const sweep = (pct / total) * 360;
      const s = { asset, start: cumAngle, end: cumAngle + sweep, color: ASSET_COLORS[asset] ?? "#555" };
      cumAngle += sweep;
      return s;
    });

  return (
    <div className="glass rounded-2xl p-6">
      <p className="mb-5 text-xs font-medium uppercase tracking-wider text-white/30">
        Long-term Portfolio
      </p>

      <div className="flex items-center gap-6">
        <svg width="100" height="100" viewBox="0 0 100 100" className="flex-shrink-0">
          {slices.map((s) => (
            <path key={s.asset} d={arcPath(s.start, s.end)} fill={s.color} opacity={0.9} />
          ))}
          <circle cx="50" cy="50" r="22" fill="#000" />
          <text x="50" y="53" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.5)" fontFamily="ui-monospace">
            alloc
          </text>
        </svg>

        <div>
          <p className="font-mono-data text-3xl font-bold text-white">
            {cur.toLocaleString("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 })}
          </p>
          <p className={`mt-1 font-mono-data text-base font-semibold ${isPos ? "text-[#30d158]" : "text-[#ff453a]"}`}>
            {isPos ? "+" : ""}{ret.toFixed(2)}%
          </p>
          <p className="mt-2 text-xs text-white/25">
            Started {portfolio.initial_amount_chf.toLocaleString("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {slices.map(({ asset, color }) => (
          <span key={asset} className="flex items-center gap-1.5 text-xs text-white/40">
            <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: color }} />
            {ASSET_INFO[asset as AssetKey]?.name ?? asset} {alloc[asset]}%
          </span>
        ))}
      </div>
    </div>
  );
}
