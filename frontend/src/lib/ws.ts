import type { WsMessage } from "./types";

const WS_URL = (
  process.env.NEXT_PUBLIC_WS_URL ??
  (process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.replace(/^http/, "ws")
    : "ws://localhost:8000")
).replace(/\/+$/, "");

type MessageHandler = (msg: WsMessage) => void;

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

/**
 * Minimal WebSocket client for battle mode with automatic reconnection.
 * Connects to /ws/battle/{roomId} and routes incoming messages.
 * On unexpected disconnect, retries up to MAX_RETRIES times with exponential backoff.
 */
export function createBattleSocket(
  roomId: string,
  onMessage: MessageHandler,
  onClose?: () => void,
  onOpen?: () => void,
) {
  const url = `${WS_URL}/ws/battle/${roomId}`;
  let ws: WebSocket;
  let retries = 0;
  let manuallyClosed = false;
  let pendingJoin: WsMessage | null = null;

  function connect() {
    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log(`[WS] Connected to room ${roomId} (attempt ${retries + 1})`);
      retries = 0;
      // Re-send join on reconnect so the server re-attaches the player
      if (pendingJoin) {
        ws.send(JSON.stringify(pendingJoin));
      }
      onOpen?.();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsMessage;
        // Stop retrying once the battle is finished
        if (data.type === "result" || data.type === "error") {
          retries = MAX_RETRIES;
        }
        onMessage(data);
      } catch {
        console.warn("[WS] Failed to parse message:", event.data);
      }
    };

    ws.onclose = () => {
      if (manuallyClosed) {
        console.log(`[WS] Disconnected from room ${roomId}`);
        onClose?.();
        return;
      }
      if (retries < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, retries);
        retries++;
        console.warn(`[WS] Lost connection — reconnecting in ${delay}ms (attempt ${retries}/${MAX_RETRIES})`);
        setTimeout(connect, delay);
      } else {
        console.error("[WS] Max reconnection attempts reached.");
        onClose?.();
      }
    };

    ws.onerror = (err) => {
      console.error("[WS] Error:", err);
    };
  }

  connect();

  /** Send a typed message to the server. Buffers join messages for reconnection. */
  function send(msg: WsMessage) {
    if (msg.type === "join") {
      pendingJoin = msg;
    }
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  /** Close the connection and stop reconnection attempts. */
  function close() {
    manuallyClosed = true;
    ws.close();
  }

  return { send, close, get ws() { return ws; } };
}

export type OnlinePlayer = { id: string; username: string; in_battle: boolean; has_strategy: boolean };
