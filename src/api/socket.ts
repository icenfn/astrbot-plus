/**
 * Socket.io client for the AstrBot+ companion plugin (`astrbot_plugin_plus`).
 *
 * The plugin exposes a single dedicated port (default 6199). Everything the
 * client needs — the Agent (bot) list, streaming chat and the message feed —
 * travels over this one Socket.io connection. No access key is required: the
 * address alone is enough to connect.
 *
 * Wire protocol (client → server):
 *   ping                → { pong: true }
 *   config              → server capabilities / defaults
 *   bots:list           → { status, data: [{ id, name, nickname, ... }] }
 *   chat:history        → { sessionId, messages: [...] }   （历史消息同步）
 *   chat:send           → stream replies back via chat:* events
 *   chat:delete         → drop a session's server-side history (long-press 删除)
 *     payload: { text, botId, sessionId } (reqId is generated client-side)
 *
 * Wire protocol (server → client):
 *   chat:session        → { reqId, sessionId }
 *   chat:delta          → { reqId, delta }         （流式增量，未开启流式时可能不发）
 *   chat:done           → { reqId, text, sessionId }（完整文本，无论是否流式）
 *   chat:error          → { reqId, message }
 *   message:new         → { sessionId, botId, role, text, ts }（新消息广播）
 */
import { io, type Socket } from "socket.io-client";
import type { HistoryMessage, PluginConfig } from "./types";

/** Normalise a bare host[:port] or url into a Socket.io endpoint url. */
export function normalizeSocketUrl(raw: string): string {
  let value = (raw || "").trim();
  if (!value) return "";
  // Accept ws:// / wss:// and bare host[:port] alike; socket.io-client expects an
  // http(s) base url and negotiates the websocket upgrade itself. Previously a
  // ws:// input produced the invalid "http://ws://…" and broke the connection.
  value = value.replace(/^wss:\/\//i, "https://").replace(/^ws:\/\//i, "http://");
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
  return value.replace(/\/+$/, "");
}

/** Generate a unique request id for correlating a chat stream. */
function genReqId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Live connection state, suitable for driving a status chip. */
export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

/** Human-readable Socket.io transport currently in use. */
export type SocketIOMode = "websocket" | "polling" | "—";

export interface ChatStreamHandlers {
  onSession?: (sessionId: string) => void;
  /** delta is the newest chunk; full is the accumulated reply so far. */
  onDelta?: (delta: string, full: string) => void;
  onDone?: (text: string, sessionId: string | null) => void;
  onError?: (err: Error) => void;
}

interface PluginBot {
  id: string;
  name?: string;
  nickname?: string;
  /** Platform adapter type (e.g. `astrbot_plus`). */
  platform?: string;
  /** Enabled flag from the WebUI「创建机器人」page. */
  enabled?: boolean;
  [k: string]: unknown;
}

export class PlusSocket {
  private url: string;
  private socket: Socket | null = null;
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  private statusListeners = new Set<(s: ConnectionState) => void>();
  private status: ConnectionState = "idle";

  constructor(url: string) {
    this.url = normalizeSocketUrl(url);
  }

  get connected(): boolean {
    return !!this.socket?.connected;
  }

  /** Current transport reported by Engine.IO (websocket / polling). */
  get mode(): SocketIOMode {
    const socket = this.socket;
    if (!socket) return "—";
    const transport = (
      socket.io as unknown as { engine?: { transport?: { name?: string } } }
    )?.engine?.transport?.name;
    if (transport === "websocket" || transport === "polling") return transport;
    // Engine.IO only exposes the transport name while connected; fall back to a
    // best-effort value so the status chip is never empty while connected.
    return socket.connected ? "polling" : "—";
  }

  get state(): ConnectionState {
    return this.status;
  }

  /** Subscribe to connection-state changes. Returns an unsubscribe function. */
  onStatus(cb: (s: ConnectionState) => void): () => void {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  private setStatus(next: ConnectionState): void {
    if (this.status === next) return;
    this.status = next;
    for (const cb of this.statusListeners) cb(next);
  }

  async connect(): Promise<void> {
    if (this.socket?.connected) return;
    this.socket?.close();
    this.setStatus("connecting");
    const socket = io(this.url, {
      // Engine.IO default order: start with long-polling, then upgrade to a
      // websocket. This is the most compatible behaviour — an earlier build
      // forced "websocket first + upgrade disabled", which fails outright on
      // networks/proxies that block the websocket upgrade and produced the
      // opaque "websocket error". Letting socket.io negotiate (polling →
      // websocket) makes the connection work everywhere.
      //   transports: ["polling", "websocket"]  (default, hence omitted)
      //   upgrade: true                         (default, hence omitted)
      path: "/socket.io",
      // ---- keep-alive + automatic reconnection -------------------------
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 20000,
    });
    this.attach(socket);
    await new Promise<void>((resolve, reject) => {
      const onConnect = () => {
        cleanup();
        this.setStatus("connected");
        resolve();
      };
      const onError = (err: Error) => {
        cleanup();
        this.setStatus("disconnected");
        reject(new Error(err.message || "connect_error"));
      };
      const cleanup = () => {
        socket.off("connect", onConnect);
        socket.off("connect_error", onError);
      };
      socket.on("connect", onConnect);
      socket.on("connect_error", onError);
    });
  }

  private attach(socket: Socket): void {
    this.socket = socket;
    socket.onAny((event: string, ...args: unknown[]) => {
      const set = this.listeners.get(event);
      if (set) {
        for (const cb of set) cb(...args);
      }
    });
    // Surface lifecycle transitions so the UI can always show the real state
    // and the user can see automatic reconnection happening.
    socket.on("connect", () => this.setStatus("connected"));
    socket.on("disconnect", () => this.setStatus("disconnected"));
    socket.io.on("reconnect_attempt", () => this.setStatus("reconnecting"));
    socket.io.on("reconnect", () => this.setStatus("connected"));
    socket.io.on("error", () => this.setStatus("reconnecting"));
  }

  on(event: string, cb: (...args: unknown[]) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(cb);
    return () => set!.delete(cb);
  }

  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.close();
    this.socket = null;
    this.setStatus("idle");
  }

  /** Fetch the Agent list. Returns [] when the request fails. */
  async listBots(): Promise<PluginBot[]> {
    const res = await this.request<
      { status?: string; data?: PluginBot[] } | PluginBot[]
    >("bots:list", {});
    if (Array.isArray(res)) return res;
    if (res && Array.isArray((res as { data?: PluginBot[] }).data)) {
      return (res as { data: PluginBot[] }).data;
    }
    return [];
  }

  /** Fetch the plugin's server capabilities / defaults (`config` event). */
  async getConfig(): Promise<PluginConfig | null> {
    return this.request<PluginConfig>("config", {});
  }

  /**
   * Delete a session server-side: the plugin drops its in-memory history and
   * broadcast a `chat:deleted` event so every connected client clears the row.
   */
  async deleteSession(sessionId: string, botId = ""): Promise<boolean> {
    const res = await this.request<{ deleted?: boolean }>("chat:delete", {
      sessionId,
      botId,
    });
    return !!res && res.deleted !== false;
  }

  /** Fetch a session's message history (client-side history sync). */
  async fetchHistory(sessionId: string, limit = 200): Promise<HistoryMessage[]> {
    const res = await this.request<{ messages?: HistoryMessage[] }>(
      "chat:history",
      { sessionId, limit },
    );
    return res && Array.isArray(res.messages) ? res.messages : [];
  }

  /**
   * Send a chat message and stream the reply.
   *
   * A request id is generated internally to correlate this stream with the
   * server-pushed `chat:*` events (which the plugin addresses to this socket).
   * Returns a synchronous unsubscribe function that detaches the listeners.
   * Delivery failure surfaces through `handlers.onError`.
   *
   * Works whether or not the bot has streaming output enabled: with streaming
   * off the plugin sends a single `chat:done` carrying the full text (and no
   * `chat:delta` events), which `onDone` already handles.
   */
  sendChat(
    payload: { text: string; botId?: string; sessionId?: string },
    handlers: ChatStreamHandlers,
  ): () => void {
    const reqId = genReqId();
    let full = "";
    let done = false;

    const offs: Array<() => void> = [
      this.on("chat:session", (raw) => {
        const d = raw as { reqId?: string; sessionId?: string };
        if (d?.reqId === reqId && d.sessionId) handlers.onSession?.(d.sessionId);
      }),
      this.on("chat:delta", (raw) => {
        const d = raw as { reqId?: string; delta?: string };
        if (d?.reqId === reqId && d.delta) {
          full += d.delta;
          handlers.onDelta?.(d.delta, full);
        }
      }),
      this.on("chat:done", (raw) => {
        const d = raw as { reqId?: string; text?: string; sessionId?: string };
        if (d?.reqId !== reqId || done) return;
        done = true;
        // When the bot has streaming off, only `text` is present and `full` is
        // empty — prefer the server-provided complete text in that case.
        handlers.onDone?.(d.text ?? full, d.sessionId ?? null);
      }),
      this.on("chat:error", (raw) => {
        const d = raw as { reqId?: string; message?: string };
        if (d?.reqId !== reqId || done) return;
        done = true;
        handlers.onError?.(new Error(d.message ?? "未知错误"));
      }),
    ];

    // Fire-and-forget send; only a hard connection failure surfaces via onError
    // (the plugin reports downstream problems through the chat:error event).
    void (async () => {
      try {
        const socket = await this.ensureConnected();
        socket.timeout(15000).emit("chat:send", { ...payload, reqId }, () => {
          /* ack optional */
        });
      } catch (e) {
        if (!done) {
          done = true;
          handlers.onError?.(e instanceof Error ? e : new Error(String(e)));
        }
      }
    })();

    return () => offs.forEach((off) => off());
  }

  private async ensureConnected(): Promise<Socket> {
    if (!this.socket?.connected) await this.connect();
    if (!this.socket) throw new Error("Socket 未连接");
    return this.socket;
  }

  /** Emit an event expecting an acknowledgement payload, with timeout. */
  private async request<T>(event: string, payload: unknown): Promise<T | null> {
    const socket = await this.ensureConnected();
    try {
      const res = (await socket
        .timeout(10000)
        .emitWithAck(event, payload)) as T;
      return res;
    } catch (e) {
      void e;
      return null;
    }
  }
}
