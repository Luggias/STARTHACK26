import type {
  Allocation,
  BattleResult,
  GBMResult,
  LongtermPortfolio,
  MonteCarloResult,
  ScenarioMeta,
  SimulationResult,
  Strategy,
  TickerPrice,
  User,
  Clan,
  LeaderboardEntry,
} from "./types";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("cmiyc-game-store");
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> ?? {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API error ${res.status}: ${detail}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function authRegister(data: {
  full_name: string;
  email: string;
  password: string;
  age?: number;
  country?: string;
  username?: string;
}): Promise<{ token: string; user: User }> {
  return fetchJson("/auth/register", { method: "POST", body: JSON.stringify(data) });
}

export async function authLogin(email: string, password: string): Promise<{ token: string; user: User }> {
  return fetchJson("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export async function getMe(): Promise<User> {
  return fetchJson("/auth/me");
}

// ---------------------------------------------------------------------------
// Ticker
// ---------------------------------------------------------------------------

export async function getTickerPrices(): Promise<TickerPrice[]> {
  const data = await fetchJson<{ prices: TickerPrice[] }>("/ticker/prices");
  return data.prices;
}

// ---------------------------------------------------------------------------
// Legacy player (battle mode)
// ---------------------------------------------------------------------------

export async function registerPlayer(username: string): Promise<{ id: string; username: string }> {
  const data = await fetchJson<{ player: { id: string; username: string } }>("/players", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
  return data.player;
}

// ---------------------------------------------------------------------------
// Scenarios & simulation
// ---------------------------------------------------------------------------

export async function getScenarios(): Promise<ScenarioMeta[]> {
  const data = await fetchJson<{ scenarios: ScenarioMeta[] }>("/scenarios");
  return data.scenarios;
}

export async function simulate(allocation: Allocation, scenarioKey: string): Promise<SimulationResult> {
  return fetchJson<SimulationResult>("/simulate", {
    method: "POST",
    body: JSON.stringify({ allocation, scenario_key: scenarioKey }),
  });
}

export async function simulateGBM(
  allocation: Allocation,
  years = 20,
  seed?: number,
  injectEvents = true,
): Promise<GBMResult> {
  return fetchJson<GBMResult>("/simulate/gbm", {
    method: "POST",
    body: JSON.stringify({ allocation, years, seed, inject_events: injectEvents }),
  });
}

export async function simulateMonteCarlo(
  allocation: Allocation,
  years = 20,
  nPaths = 200,
): Promise<MonteCarloResult> {
  return fetchJson<MonteCarloResult>("/simulate/montecarlo", {
    method: "POST",
    body: JSON.stringify({ allocation, years, n_paths: nPaths }),
  });
}

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------

export async function saveStrategy(data: {
  name: string;
  allocation: Allocation;
  scenario_key: string;
  result: Partial<SimulationResult>;
}): Promise<{ strategy: Strategy; unlocked_next: string }> {
  return fetchJson("/strategies", { method: "POST", body: JSON.stringify(data) });
}

export async function getMyStrategies(): Promise<Strategy[]> {
  const data = await fetchJson<{ strategies: Strategy[] }>("/strategies/me");
  return data.strategies;
}

export async function getTop3Strategies(): Promise<Strategy[]> {
  const data = await fetchJson<{ strategies: Strategy[] }>("/strategies/top3");
  return data.strategies;
}

// ---------------------------------------------------------------------------
// Long-term portfolio
// ---------------------------------------------------------------------------

export async function initLongtermPortfolio(
  allocation: Allocation,
  initialAmountChf = 10000,
): Promise<LongtermPortfolio> {
  const data = await fetchJson<{ portfolio: LongtermPortfolio }>("/portfolio/longterm", {
    method: "POST",
    body: JSON.stringify({ allocation, initial_amount_chf: initialAmountChf }),
  });
  return data.portfolio;
}

export async function getLongtermPortfolio(): Promise<LongtermPortfolio | null> {
  const data = await fetchJson<{ portfolio: LongtermPortfolio | null }>("/portfolio/longterm/me");
  return data.portfolio;
}

export async function getLongtermHistory(): Promise<{ months: string[]; values: number[] } | null> {
  const data = await fetchJson<{ history: { months: string[]; values: number[] } | null }>("/portfolio/longterm/history");
  return data.history;
}

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

export async function getAiInsight(
  portfolio1: Allocation,
  portfolio2: Allocation,
  scenarioKey: string,
  result: { p1_return: number; p1_sharpe: number; p2_return: number; p2_sharpe: number },
): Promise<string> {
  const data = await fetchJson<{ insight: string }>("/ai/insight", {
    method: "POST",
    body: JSON.stringify({ portfolio1, portfolio2, scenario_key: scenarioKey, result }),
  });
  return data.insight;
}

export async function getAiCoach(strategies: Strategy[]): Promise<{
  personality_type: string;
  strengths: string[];
  blindspots: string[];
  risk_profile: string;
  narrative: string;
}> {
  return fetchJson("/ai/coach", {
    method: "POST",
    body: JSON.stringify({ strategies }),
  });
}

// ---------------------------------------------------------------------------
// Battle
// ---------------------------------------------------------------------------

export async function createBattle(
  playerId: string,
  username: string,
): Promise<{ room_id: string; status: string }> {
  return fetchJson("/battles", {
    method: "POST",
    body: JSON.stringify({ player_id: playerId, username }),
  });
}

export async function findOpenBattle(): Promise<{
  room: { room_id: string; player1_username: string } | null;
}> {
  return fetchJson("/battles/open");
}

export async function quickmatch(
  playerId: string,
  username: string,
  allocation?: Record<string, number>,
): Promise<{ room_id: string; status: string; joined: boolean; opponent: string | null; opponent_allocation: Record<string, number> | null; seed: number | null }> {
  return fetchJson("/battles/quickmatch", {
    method: "POST",
    body: JSON.stringify({ player_id: playerId, username, allocation }),
  });
}

export async function createPrivateBattle(
  playerId: string,
  username: string,
): Promise<{ room_id: string; invite_code: string; status: string }> {
  return fetchJson("/battles/private", {
    method: "POST",
    body: JSON.stringify({ player_id: playerId, username }),
  });
}

export async function joinByInvite(
  code: string,
): Promise<{ room_id: string; player1_username: string }> {
  return fetchJson(`/battles/invite/${code}`);
}

export async function getBattle(roomId: string) {
  return fetchJson<{
    room_id: string;
    status: string;
    player1: string | null;
    player2: string | null;
    player1_allocation: Record<string, number> | null;
    player2_allocation: Record<string, number> | null;
    results: BattleResult | null;
  }>(`/battles/${roomId}`);
}

export async function cancelBattle(roomId: string): Promise<{ ok: boolean }> {
  return fetchJson(`/battles/${roomId}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Clans
// ---------------------------------------------------------------------------

export async function createClan(name: string): Promise<{ clan: Clan }> {
  return fetchJson("/clans", { method: "POST", body: JSON.stringify({ name }) });
}

export async function joinClan(joinCode: string): Promise<{ clan: Clan }> {
  return fetchJson("/clans/join", { method: "POST", body: JSON.stringify({ join_code: joinCode }) });
}

export async function getClan(clanId: string): Promise<{ clan: Clan; members: unknown[] }> {
  return fetchJson(`/clans/${clanId}`);
}

export async function getClanLeaderboard(clanId: string): Promise<{ leaderboard: LeaderboardEntry[] }> {
  return fetchJson(`/clans/${clanId}/leaderboard`);
}

export async function getLeaderboard(): Promise<{ leaderboard: LeaderboardEntry[] }> {
  return fetchJson("/leaderboard");
}

// ---------------------------------------------------------------------------
// Username
// ---------------------------------------------------------------------------

export async function claimUsername(username: string, password: string): Promise<{ ok: boolean; username: string }> {
  return fetchJson("/username/claim", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function releaseUsername(username: string): Promise<void> {
  await fetchJson("/username/release", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------

export async function presenceHeartbeat(
  playerId: string,
  username: string,
  hasStrategy = false,
): Promise<{ ok?: boolean; go_to_battle?: string; opponent_allocation?: Record<string, number> | null; seed?: number | null; opponent_name?: string }> {
  return fetchJson("/presence/heartbeat", {
    method: "POST",
    body: JSON.stringify({ player_id: playerId, username, has_strategy: hasStrategy }),
  });
}

export async function presenceOnline(): Promise<{
  players: { id: string; username: string; in_battle: boolean; has_strategy: boolean }[];
}> {
  return fetchJson("/presence/online");
}

export async function presenceChallenge(fromId: string, targetId: string, allocation?: Record<string, number>): Promise<void> {
  await fetchJson("/presence/challenge", {
    method: "POST",
    body: JSON.stringify({ from_id: fromId, target_id: targetId, allocation }),
  });
}

export async function presenceGetChallenges(
  playerId: string,
): Promise<{ challenge: { from_id: string; from_username: string; from_allocation?: Record<string, number> | null } | null }> {
  return fetchJson(`/presence/challenges/${playerId}`);
}

export async function presenceAccept(
  playerId: string,
  fromId: string,
  allocation?: Record<string, number>,
): Promise<{ room_id: string; opponent_allocation?: Record<string, number> | null; seed?: number | null }> {
  return fetchJson("/presence/accept", {
    method: "POST",
    body: JSON.stringify({ player_id: playerId, from_id: fromId, allocation }),
  });
}

export async function presenceDecline(playerId: string, fromId: string): Promise<void> {
  await fetchJson("/presence/decline", {
    method: "POST",
    body: JSON.stringify({ player_id: playerId, from_id: fromId }),
  });
}

export async function presenceBattleEnd(playerId: string): Promise<void> {
  await fetchJson("/presence/battle-end", {
    method: "POST",
    body: JSON.stringify({ player_id: playerId }),
  });
}

export async function presenceRematch(playerId: string, opponentId: string): Promise<{ mutual: boolean }> {
  return fetchJson("/presence/rematch", {
    method: "POST",
    body: JSON.stringify({ player_id: playerId, opponent_id: opponentId }),
  });
}

export async function presenceCheckRematch(playerId: string): Promise<{ from_id: string | null }> {
  return fetchJson(`/presence/rematch/${encodeURIComponent(playerId)}`);
}

// ---------------------------------------------------------------------------
// Guest stats & leaderboards
// ---------------------------------------------------------------------------

export async function reportResult(
  playerName: string,
  won: boolean,
  returnPct: number,
  isPvP: boolean,
  opponentReturnPct = 0,
  opponentName = "A.I. FUND",
  strategyName = "",
  playerAllocation?: Record<string, number>,
  opponentAllocation?: Record<string, number>,
  scenarioKey?: string,
): Promise<{ iq: number; highscore: number }> {
  return fetchJson("/guest/report-result", {
    method: "POST",
    body: JSON.stringify({
      player_name: playerName,
      won,
      return_pct: returnPct,
      opponent_return_pct: opponentReturnPct,
      is_pvp: isPvP,
      opponent_name: opponentName,
      strategy_name: strategyName,
      player_allocation: playerAllocation,
      opponent_allocation: opponentAllocation,
      scenario_key: scenarioKey,
    }),
  });
}

export async function getGuestLeaderboard(): Promise<{
  iq_leaderboard: { player_name: string; iq: number }[];
  highscore_leaderboard: { player_name: string; highscore: number }[];
  relative_return_leaderboard: { player_name: string; relative_return: number; player_return: number; opponent_return: number }[];
}> {
  return fetchJson("/guest/leaderboard");
}

export async function getGuestStats(playerName: string): Promise<{ player_name: string; iq: number }> {
  return fetchJson(`/guest/stats/${encodeURIComponent(playerName)}`);
}

export interface GuestBattleRecord {
  id: number;
  player_name: string;
  opponent_name: string;
  strategy_name: string;
  player_return: number;
  opponent_return: number;
  won: number;
  is_pvp: number;
  played_at: string;
}

export async function syncGuestStrategies(playerName: string, strategies: unknown[]): Promise<void> {
  await fetchJson("/guest/strategies/sync", {
    method: "POST",
    body: JSON.stringify({ player_name: playerName, strategies }),
  });
}

export async function getGuestStrategies(playerName: string): Promise<unknown[]> {
  const data = await fetchJson<{ strategies: unknown[] }>(`/guest/strategies/${encodeURIComponent(playerName)}`);
  return data.strategies;
}

export async function getGuestBattles(playerName: string, limit = 50): Promise<GuestBattleRecord[]> {
  const data = await fetchJson<{ battles: GuestBattleRecord[] }>(`/guest/battles/${encodeURIComponent(playerName)}?limit=${limit}`);
  return data.battles;
}
