"use client";

import { useEffect, useState } from "react";
import { getTickerPrices } from "@/lib/api";
import type { TickerPrice } from "@/lib/types";

const FALLBACK: TickerPrice[] = [
  { symbol: "SPY", label: "S&P 500", price: 510.0, change_pct: 0.42 },
  { symbol: "TLT", label: "US Bonds", price: 92.0, change_pct: -0.15 },
  { symbol: "GLD", label: "Gold", price: 228.0, change_pct: 0.87 },
  { symbol: "BTC-USD", label: "Bitcoin", price: 85000.0, change_pct: 2.14 },
  { symbol: "CASH", label: "Cash", price: 1.0, change_pct: 0.01 },
];

function TickerItem({ item }: { item: TickerPrice }) {
  const pos = item.change_pct >= 0;
  return (
    <span className="mx-6 inline-flex items-center gap-2 whitespace-nowrap font-mono-data text-xs">
      <span className="text-slate-400">{item.label}</span>
      <span className="text-white">
        {item.price >= 1000
          ? item.price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
          : item.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <span className={pos ? "text-green-400" : "text-red-400"}>
        {pos ? "+" : ""}{item.change_pct.toFixed(2)}%
      </span>
    </span>
  );
}

export default function TickerBar() {
  const [prices, setPrices] = useState<TickerPrice[]>(FALLBACK);

  useEffect(() => {
    async function fetchPrices() {
      try {
        const data = await getTickerPrices();
        if (data.length > 0) setPrices(data);
      } catch {
        // keep fallback
      }
    }
    fetchPrices();
    const interval = setInterval(fetchPrices, 30_000);
    return () => clearInterval(interval);
  }, []);

  const doubled = [...prices, ...prices];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 h-8 overflow-hidden border-t border-white/5 bg-[#0a0a0f]/90 backdrop-blur-sm">
      <div className="flex h-full items-center">
        <div className="ticker-scroll inline-flex items-center">
          {doubled.map((item, i) => (
            <TickerItem key={`${item.symbol}-${i}`} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
