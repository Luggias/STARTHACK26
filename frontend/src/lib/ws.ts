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
