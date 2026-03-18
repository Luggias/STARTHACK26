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
