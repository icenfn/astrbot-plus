/**
 * WebSocket transport to the AstrBot+ platform adapter.
 *
 * Chat now flows over a persistent WebSocket (provided by the companion
 * `astrbot_plugin_plus` plugin) instead of HTTP/SSE:
 *   - outbound: `{ type: "send", umo, text, client_id, name }`
 *   - inbound : `{ type: "message", umo, role, text, done, ts }`
 *
 * The client reconnects automatically with exponential backoff and queues any
 * frames produced while the socket is down, so a brief drop never loses a send.
 */

export type WsStatus = "idle" | "connecting" | "open" | "closed";

export interface WsMessageFrame {
  type: string;
  umo?: string;
  role?: "user" | "assistant";
  text?: string;
  done?: boolean;
  ts?: number;
  [key: string]: unknown;
}

export interface AstrbotWsOptions {
  url: string;
  onMessage: (frame: WsMessageFrame) => void;
  onStatus?: (status: WsStatus) => void;
}

/** Cap the reconnect backoff so a long outage still retries regularly. */
const MAX_BACKOFF_MS = 15000;
const BASE_BACKOFF_MS = 800;

export class AstrbotWsClient {
  private ws: WebSocket | null = null;
  private readonly opts: AstrbotWsOptions;
  private closedByUser = false;
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private outbox: string[] = [];

  constructor(opts: AstrbotWsOptions) {
    this.opts = opts;
  }

  /** Open the connection (idempotent). */
  connect(): void {
    this.closedByUser = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.open();
  }

  private open(): void {
    if (this.closedByUser) return;
    this.opts.onStatus?.("connecting");

    let socket: WebSocket;
    try {
      socket = new WebSocket(this.opts.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = socket;

    socket.onopen = () => {
      this.retry = 0;
      this.opts.onStatus?.("open");
      // Flush anything queued while the socket was down.
      for (const frame of this.outbox.splice(0)) {
        try {
          socket.send(frame);
        } catch {
          this.outbox.unshift(frame);
          break;
        }
      }
    };

    socket.onmessage = (event) => {
      let frame: WsMessageFrame;
      try {
        frame = JSON.parse(String(event.data)) as WsMessageFrame;
      } catch {
        return; // ignore non-JSON frames
      }
      this.opts.onMessage(frame);
    };

    socket.onclose = () => {
      this.ws = null;
      if (this.closedByUser) {
        this.opts.onStatus?.("closed");
        return;
      }
      this.scheduleReconnect();
    };

    socket.onerror = () => {
      // `onclose` always follows `onerror`; reconnect is handled there.
    };
  }

  private scheduleReconnect(): void {
    this.retry += 1;
    this.opts.onStatus?.("closed");
    const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.min(this.retry, 5));
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.open(), delay);
  }

  /**
   * Send a frame. Returns true when it went out immediately, false when it was
   * queued (the socket will connect/drain it on the next open).
   */
  send(frame: Record<string, unknown>): boolean {
    const data = JSON.stringify(frame);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
      return true;
    }
    this.outbox.push(data);
    if (!this.ws) this.open();
    return false;
  }

  /** Permanently close the connection (no reconnect). */
  close(): void {
    this.closedByUser = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.outbox = [];
    this.ws?.close();
    this.ws = null;
    this.opts.onStatus?.("closed");
  }
}
