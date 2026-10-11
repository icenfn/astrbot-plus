/**
 * Socket.io client for the AstrBot+ companion plugin (`astrbot_plugin_plus`).
 *
 * The plugin exposes a single dedicated port (default 6199). Everything the
 * client needs — the Agent (bot) list and streaming chat — travels over this
 * one Socket.io connection. No access key is required: the address alone is
 * enough to connect.
 */
import { io, type Socket } from "socket.io-client";
import type { BotInfo } from "./types";

export interface SocketEnvelope<T> {
  status: "ok" | "error";
  data: T;
  message?: string | null;
}

export interface ChatSendPayload {
  sessionId?: string;
  botId?: string;
  text: string;
}

export interface ChatStreamHandlers {
  onDelta?: (delta: string, full: string) => void;
  onSession?: (sessionId: string) => void;
  onDone?: (full: string) => void;
  onError?: (error: Error) => void;
}

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

export class PlusSocket {
  private url: string;
  private socket: Socket | null = null;
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  constructor(url: string) {
    this.url = normalizeSocketUrl(url);
  }

  get configured(): boolean {
    return !!this.url;
  }

  get connected(): boolean {
    return !!this.socket?.connected;
  }

  /** Open the connection (idempotent). */
  connect(): Promise<void> {
    if (!this.url) return Promise.reject(new Error("未配置插件服务器地址"));
    if (this.socket?.connected) return Promise.resolve();
    this.socket?.close();
    const socket = io(this.url, {
      // Prefer polling first, then upgrade to websocket. Starting with polling
      // avoids failures in environments that block the raw websocket handshake
      // (e.g. strict WebView CSP or HTTP proxies). tryAllTransports makes the
      // client fall back to a working transport instead of failing outright.
      transports: ["polling", "websocket"],
      tryAllTransports: true,
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      timeout: 20000,
    });
    this.socket = socket;
    // Re-attach any listeners requested before the socket existed.
    for (const [event, set] of this.listeners) {
      for (const fn of set) socket.on(event, fn as (...args: unknown[]) => void);
    }
    return new Promise((resolve, reject) => {
      const onConnect = () => {
        socket.off("connect_error", onError);
        resolve();
      };
      const onError = (err: Error) => {
        socket.off("connect", onConnect);
        reject(err instanceof Error ? err : new Error(String(err)));
      };
      socket.once("connect", onConnect);
      socket.once("connect_error", onError);
    });
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }

  /** Emit an event that the server answers with an acknowledgement envelope. */
  private request<T>(event: string, payload: unknown = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const socket = this.socket;
      if (!socket || !socket.connected) {
        reject(new Error("尚未连接到 AstrBot+ 插件"));
        return;
      }
      const timer = window.setTimeout(() => reject(new Error("插件响应超时")), 20000);
      socket.emit(event, payload, (res: SocketEnvelope<T> | T) => {
        window.clearTimeout(timer);
        const env = res as SocketEnvelope<T>;
        if (env && typeof env === "object" && "status" in env) {
          if (env.status === "error") reject(new Error(env.message || "操作失败"));
          else resolve(env.data);
        } else {
          resolve(res as T);
        }
      });
    });
  }

  ping(): Promise<{ pong: boolean }> {
    return this.request("ping");
  }

  listBots(): Promise<BotInfo[]> {
    return this.request<BotInfo[]>("bots:list").then((v) => v ?? []);
  }

  /**
   * Send a chat message and stream the reply.
   * Returns a cleanup function that detaches this request's listeners.
   */
  sendChat(payload: ChatSendPayload, handlers: ChatStreamHandlers = {}): () => void {
    const socket = this.socket;
    if (!socket) throw new Error("尚未连接到 AstrBot+ 插件");
    const reqId = `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    let full = "";

    const onDelta = (raw: unknown) => {
      const d = raw as { reqId?: string; delta?: string };
      if (d?.reqId !== reqId || typeof d.delta !== "string") return;
      full += d.delta;
      handlers.onDelta?.(d.delta, full);
    };
    const onSession = (raw: unknown) => {
      const d = raw as { reqId?: string; sessionId?: string };
      if (d?.reqId !== reqId || !d.sessionId) return;
      handlers.onSession?.(d.sessionId);
    };
    const onDone = (raw: unknown) => {
      const d = raw as { reqId?: string; text?: string };
      if (d?.reqId !== reqId) return;
      cleanup();
      const final = full || d.text || "";
      handlers.onDone?.(final);
    };
    const onError = (raw: unknown) => {
      const d = raw as { reqId?: string; message?: string };
      if (d?.reqId !== reqId) return;
      cleanup();
      handlers.onError?.(new Error(d.message || "聊天出错"));
    };

    function cleanup() {
      socket?.off("chat:delta", onDelta);
      socket?.off("chat:session", onSession);
      socket?.off("chat:done", onDone);
      socket?.off("chat:error", onError);
    }

    socket.on("chat:delta", onDelta);
    socket.on("chat:session", onSession);
    socket.on("chat:done", onDone);
    socket.on("chat:error", onError);
    socket.emit("chat:send", { ...payload, reqId });
    return cleanup;
  }
}
