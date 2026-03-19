import type { WsMessage } from "./types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

type MessageHandler = (msg: WsMessage) => void;

/**
 * Minimal WebSocket client for battle mode.
 * Connects to /ws/battle/{roomId} and routes incoming messages.
 */
export function createBattleSocket(
  roomId: string,
  onMessage: MessageHandler,
  onClose?: () => void,
) {
  const url = `${WS_URL}/ws/battle/${roomId}`;
  const ws = new WebSocket(url);

  ws.onopen = () => {
    console.log(`[WS] Connected to room ${roomId}`);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as WsMessage;
      onMessage(data);
    } catch {
      console.warn("[WS] Failed to parse message:", event.data);
    }
  };

  ws.onclose = () => {
    console.log(`[WS] Disconnected from room ${roomId}`);
    onClose?.();
  };

  ws.onerror = (err) => {
    console.error("[WS] Error:", err);
  };

  /** Send a typed message to the server. */
  function send(msg: WsMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  /** Close the connection. */
  function close() {
    ws.close();
  }

  return { send, close, ws };
}

/**
 * Presence WebSocket — tracks online players & handles battle requests.
 */
export type OnlinePlayer = { id: string; username: string; in_battle: boolean };

export type PresenceMessage =
  | { type: "player_list"; players: OnlinePlayer[] }
  | { type: "battle_request"; from_id: string; from_username: string }
  | { type: "go_to_battle"; room_id: string }
  | { type: "challenge_declined"; by_username: string };

export function createPresenceSocket(
  playerId: string,
  username: string,
  onMessage: (msg: PresenceMessage) => void,
) {
  const url = `${WS_URL}/ws/presence`;
  const ws = new WebSocket(url);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "register", player_id: playerId, username }));
  };

  ws.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data) as PresenceMessage);
    } catch {}
  };

  ws.onclose = () => {};
  ws.onerror = () => {};

  function send(msg: Record<string, unknown>) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function close() {
    ws.close();
  }

  return { send, close, ws };
}
