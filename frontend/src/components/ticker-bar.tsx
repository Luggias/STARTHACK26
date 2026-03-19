"use client";

import { useEffect, useState } from "react";
import { getTickerPrices } from "@/lib/api";
import type { TickerPrice } from "@/lib/types";

const FALLBACK: TickerPrice[] = [
  { symbol: "SPY",    label: "S&P 500",  price: 510.0,   change_pct: 0.42 },
  { symbol: "TLT",    label: "Bonds",    price: 92.0,    change_pct: -0.15 },
  { symbol: "GLD",    label: "Gold",     price: 228.0,   change_pct: 0.87 },
  { symbol: "BTC-USD",label: "Bitcoin",  price: 85000.0, change_pct: 2.14 },
  { symbol: "CASH",   label: "Cash",     price: 1.0,     change_pct: 0.01 },
];

export default function TickerBar() {
  const [prices, setPrices] = useState<TickerPrice[]>(FALLBACK);

  useEffect(() => {
    const load = async () => {
      try {
        const d = await getTickerPrices();
        if (d.length > 0) setPrices(d);
      } catch { /* keep fallback */ }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const items = [...prices, ...prices];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 h-7 overflow-hidden border-t border-white/[0.06] bg-black/80 backdrop-blur-xl">
      <div className="flex h-full items-center">
        <div className="ticker-scroll inline-flex items-center gap-0">
          {items.map((p, i) => {
            const pos = p.change_pct >= 0;
            return (
              <span key={i} className="mx-8 inline-flex items-center gap-2 whitespace-nowrap font-mono-data text-[11px]">
                <span className="font-semibold text-white/50">{p.label}</span>
                <span className="text-white/80">
                  {p.price >= 1000
                    ? p.price.toLocaleString("en-US", { maximumFractionDigits: 0 })
                    : p.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={pos ? "text-[#30d158]" : "text-[#ff453a]"}>
                  {pos ? "+" : ""}{p.change_pct.toFixed(2)}%
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
