import type { Allocation, AssetClass } from "./types";

export const DEFAULT_ALLOCATION: Allocation = {
  stocks: 20,
  bonds: 20,
  gold: 20,
  cash: 20,
  crypto: 20,
};

export const ASSET_KEYS = ["stocks", "bonds", "gold", "cash", "crypto"] as const;
export type AssetKey = (typeof ASSET_KEYS)[number];

/** Client-side asset metadata (mirrors backend but available offline) */
export const ASSET_INFO: Record<AssetKey, AssetClass> = {
  stocks: {
    name: "Stocks",
    icon: "📈",
    risk_level: 4,
    description:
      "Stocks represent ownership in companies. When you buy stocks, you own a small piece of businesses like Apple, Nestle, or Toyota. Stocks tend to grow over long periods but can swing wildly in the short term.",
    typical_return: "7-10% per year",
    color: "#3B82F6",
  },
  bonds: {
    name: "Bonds",
    icon: "🏦",
    risk_level: 2,
    description:
      "Bonds are loans you give to governments or companies. In return, they pay you regular interest. Bonds are considered safer than stocks — they provide steady income and act as a cushion when stock markets crash.",
    typical_return: "2-5% per year",
    color: "#10B981",
  },
  gold: {
    name: "Gold",
    icon: "🥇",
    risk_level: 3,
    description:
      "Gold has been a store of value for thousands of years. It tends to hold its value during crises and inflation. When everything else falls, gold often rises — the ultimate safe haven asset.",
    typical_return: "4-7% per year",
    color: "#F59E0B",
  },
  cash: {
    name: "Cash",
    icon: "💵",
    risk_level: 1,
    description:
      "Cash is the safest asset class. Your money stays stable and earns a small amount of interest. The downside? Inflation slowly eats away at its purchasing power over time.",
    typical_return: "0.5-3% per year",
    color: "#6B7280",
  },
  crypto: {
    name: "Crypto",
    icon: "₿",
    risk_level: 5,
    description:
      "Cryptocurrencies like Bitcoin are digital assets built on blockchain technology. They can deliver explosive gains — or devastating losses. Prices can swing 20% in a single day.",
    typical_return: "Highly unpredictable",
    color: "#8B5CF6",
  },
};
