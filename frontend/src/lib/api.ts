import type {
  Allocation,
  BattleResult,
  Player,
  ScenarioMeta,
  SimulationResult,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API error ${res.status}: ${detail}`);
  }
  return res.json();
}

/** Register a new player (username only). */
export async function registerPlayer(username: string): Promise<Player> {
  const data = await fetchJson<{ player: Player }>("/players", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
  return data.player;
}

/** List all available historical scenarios. */
export async function getScenarios(): Promise<ScenarioMeta[]> {
  const data = await fetchJson<{ scenarios: ScenarioMeta[] }>("/scenarios");
  return data.scenarios;
}

/** Run a portfolio simulation against a historical scenario. */
export async function simulate(
  allocation: Allocation,
  scenarioKey: string,
): Promise<SimulationResult> {
  return fetchJson<SimulationResult>("/simulate", {
    method: "POST",
    body: JSON.stringify({ allocation, scenario_key: scenarioKey }),
  });
}

/** Get AI educational insight for a battle result. */
export async function getAiInsight(
  portfolio1: Allocation,
  portfolio2: Allocation,
  scenarioKey: string,
  result: {
    p1_return: number;
    p1_sharpe: number;
    p2_return: number;
    p2_sharpe: number;
  },
): Promise<string> {
  const data = await fetchJson<{ insight: string }>("/ai/insight", {
    method: "POST",
    body: JSON.stringify({
      portfolio1,
      portfolio2,
      scenario_key: scenarioKey,
      result,
    }),
  });
  return data.insight;
}

/** Create a new battle room. */
export async function createBattle(
  playerId: string,
  username: string,
): Promise<{ room_id: string; status: string }> {
  return fetchJson("/battles", {
    method: "POST",
    body: JSON.stringify({ player_id: playerId, username }),
  });
}

/** Find an open battle room to join. */
export async function findOpenBattle(): Promise<{
  room: { room_id: string; player1_username: string } | null;
}> {
  return fetchJson("/battles/open");
}

/** Get battle room status. */
export async function getBattle(roomId: string) {
  return fetchJson<{
    room_id: string;
    status: string;
    player1: string | null;
    player2: string | null;
    results: BattleResult | null;
  }>(`/battles/${roomId}`);
}
