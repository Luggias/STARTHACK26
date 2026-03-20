export interface User {
  id: string;
  username: string;
  full_name: string;
  email: string;
  age?: number;
  country?: string;
  invest_iq: number;
  risk_profile: string;
  created_at?: string;
}

/** Legacy player type — kept for battle mode backward compat */
export interface Player {
  id: string;
  username: string;
  created_at?: string;
}

export interface AssetClass {
  name: string;
  icon: string;
  risk_level: number;
  description: string;
  typical_return: string;
  color: string;
}

export interface Allocation {
  stocks: number;
  bonds: number;
  gold: number;
  cash: number;
  crypto: number;
}

export interface ScenarioMeta {
  key: string;
  name: string;
  period: string;
  description: string;
  lesson: string;
  num_months: number;
}

export interface SimulationResult {
  months: string[];
  values: number[];
  final_value: number;
  total_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  asset_contributions: Record<string, number>;
}

export interface GBMResult {
  months: string[];
  values: number[];
  total_return: number;
  final_value: number;
  events_triggered: MarketEvent[];
}

export interface MonteCarloResult {
  months: string[];
  p5: number[];
  p50: number[];
  p95: number[];
}

export interface MarketEvent {
  key: string;
  headline: string;
  description: string;
  step: number;
  step_frac: number;
}

export interface Strategy {
  id?: string;
  user_id?: string;
  name: string;
  allocation: Record<string, number>;
  scenario_key?: string;
  selectedAssets?: Record<string, string[]>;
  result?: Partial<SimulationResult>;
  created_at?: string;
}

export interface LongtermPortfolio {
  id?: string;
  user_id?: string;
  allocation: Allocation;
  initial_amount_chf: number;
  current_value?: number;
  current_return?: number;
  started_at?: string;
}

export interface Clan {
  id: string;
  name: string;
  join_code: string;
  created_by: string;
  created_at?: string;
}

export interface TickerPrice {
  symbol: string;
  label: string;
  price: number;
  change_pct: number;
}

export interface BattlePlayerResult {
  player_id: string;
  username: string;
  portfolio: Allocation;
  final_value: number;
  total_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  score: number;
  values: number[];
}

export interface BattleResult {
  winner_id: string | null;
  p1: BattlePlayerResult;
  p2: BattlePlayerResult;
  months: string[];
  scenario_key: string;
}

export type BattlePhase =
  | "lobby"
  | "waiting"
  | "building"
  | "simulating"
  | "finished";

export interface WsMessage {
  type: string;
  [key: string]: unknown;
}

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  total_battles: number;
  wins: number;
  avg_return: number;
  invest_iq: number;
}

export interface BattleRecord {
  playerName: string;
  strategyName: string;
  returnPct: number;
  cpuReturnPct: number;
  won: boolean;
  date: string;
  opponentName?: string;
}
