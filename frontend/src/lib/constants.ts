import type { Allocation, AssetClass } from "./types";

export const ASSET_CLASSES = {
  equities: {
    label: "Equities",
    color: "#2997ff",
    icon: "↗",
    simKey: "stocks",
    info: "Stocks represent ownership stakes in public companies. When a company profits, shareholders benefit through price appreciation or dividends. Equities historically deliver the highest long-run returns but come with significant short-term volatility.",
    examples: [
      { id: "aapl",  label: "Apple",     ticker: "AAPL",  info: "The world's most valuable company. Makes the iPhone, Mac, and services like the App Store. Known for loyal customers, strong cash flow, and consistent buybacks." },
      { id: "msft",  label: "Microsoft", ticker: "MSFT",  info: "Dominant in enterprise software (Windows, Office) and the fastest-growing cloud platform (Azure). Backed by massive recurring revenue and a stake in OpenAI." },
      { id: "googl", label: "Alphabet",  ticker: "GOOGL", info: "Parent of Google — controlling ~90% of global search. Also owns YouTube, Google Cloud, and Waymo. Generates most revenue from digital advertising." },
      { id: "amzn",  label: "Amazon",    ticker: "AMZN",  info: "The e-commerce giant that also runs AWS, the world's leading cloud platform. AWS alone accounts for the majority of Amazon's operating profit." },
      { id: "tsla",  label: "Tesla",     ticker: "TSLA",  info: "Pioneer of mass-market electric vehicles. Also sells energy storage and solar products. Highly volatile — trades more like a tech growth stock than a car company." },
    ],
  },
  etfs: {
    label: "ETFs",
    color: "#30d158",
    icon: "◫",
    simKey: "stocks",
    info: "Exchange-Traded Funds are baskets of securities that track an index or sector, trading on exchanges like a stock. They offer instant diversification at very low cost — ideal for investors who want broad market exposure without picking individual stocks.",
    examples: [
      { id: "spy",  label: "S&P 500",       ticker: "SPY",  info: "Tracks the 500 largest US companies. The most widely held ETF in the world. Owning SPY means owning a slice of Apple, Microsoft, Amazon, and 497 others in one trade." },
      { id: "iwda", label: "MSCI World",     ticker: "IWDA", info: "Covers ~1,500 large and mid-cap stocks across 23 developed countries. A single fund that gives you exposure to the US, Europe, Japan, and more — the true global portfolio." },
      { id: "qqq",  label: "Nasdaq 100",     ticker: "QQQ",  info: "Tracks the 100 largest non-financial companies on the Nasdaq — heavily weighted to big tech. Higher growth potential than SPY but also higher volatility." },
      { id: "vti",  label: "Total Market",   ticker: "VTI",  info: "Vanguard's entire US stock market in one fund — over 3,500 companies from mega-caps to small-caps. Ultra-low cost and extremely broad diversification." },
      { id: "arkk", label: "ARK Innovation", ticker: "ARKK", info: "Actively managed fund focused on disruptive innovation: AI, robotics, genomics, fintech. Delivered massive gains in 2020 and steep losses in 2022 — high risk, high reward." },
    ],
  },
  bonds: {
    label: "Bonds",
    color: "#ff9f0a",
    icon: "⎍",
    simKey: "bonds",
    info: "Bonds are debt instruments — you lend money to a government or corporation in exchange for regular interest payments and return of principal at maturity. They act as a portfolio stabiliser, cushioning losses when stock markets fall.",
    examples: [
      { id: "tlt",  label: "US Treasury 10Y",  ticker: "TLT",  info: "A loan to the US government repaid in 10 years, paying a fixed interest rate. Considered the world's safest investment — the benchmark everything else is priced against. Falls in value when interest rates rise." },
      { id: "bund", label: "German Bund 10Y",   ticker: "BUND", info: "The European equivalent of the US Treasury — a 10-year loan to the German government. Germany's AAA credit rating makes it the safe-haven anchor of European bond markets." },
      { id: "lqd",  label: "Investment Grade",  ticker: "LQD",  info: "A fund of bonds issued by financially strong corporations (rated BBB or higher). Pays more interest than government bonds in exchange for slightly more risk — still considered relatively safe." },
      { id: "hyg",  label: "High Yield",        ticker: "HYG",  info: "Bonds from companies with lower credit ratings ('junk bonds'). They pay significantly higher interest to compensate for higher default risk. Behaves more like equities during market stress." },
      { id: "emb",  label: "Emerging Market",   ticker: "EMB",  info: "Bonds issued by governments in developing countries (Brazil, Mexico, Indonesia, etc.). Offers higher yields than developed-market bonds but carries currency risk and political risk." },
    ],
  },
  commodities: {
    label: "Commodities",
    color: "#ff453a",
    icon: "◈",
    simKey: "gold",
    info: "Physical goods like precious metals, energy, and agricultural products. Commodities tend to hold their value during inflation and geopolitical crises. Gold in particular has served as a store of value for thousands of years.",
    examples: [
      { id: "gold",   label: "Gold",        ticker: "XAU", info: "The original store of value — held for thousands of years as a hedge against inflation and crisis. When currencies weaken or markets crash, gold typically rises. No yield, but powerful insurance." },
      { id: "silver", label: "Silver",      ticker: "XAG", info: "Like gold but with industrial applications too (solar panels, electronics). More volatile than gold and more sensitive to economic cycles. Often called 'gold on steroids'." },
      { id: "oil",    label: "Crude Oil",   ticker: "WTI", info: "West Texas Intermediate — the US benchmark for crude oil prices. Drives the global economy and is highly sensitive to geopolitical events, OPEC decisions, and demand from China." },
      { id: "natgas", label: "Natural Gas", ticker: "NG",  info: "Used for heating, electricity generation, and industry. Extremely volatile — prices can swing 50%+ in a single season depending on weather and supply disruptions." },
      { id: "copper", label: "Copper",      ticker: "HG",  info: "The metal with a PhD in economics. Used in everything from wiring to EV batteries. Rising copper prices signal strong global growth; falling prices warn of slowdowns." },
    ],
  },
} as const;

export type AssetClassKey = keyof typeof ASSET_CLASSES;
export const ASSET_CLASS_KEYS = Object.keys(ASSET_CLASSES) as AssetClassKey[];

export const ASSET_CHECKPOINT_LABELS: Record<string, string> = {
  stocks: "Equities",
  bonds: "Fixed Income",
  gold: "Commodities",
  cash: "Money Market",
  crypto: "Digital Assets",
};

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
