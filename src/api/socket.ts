/**
 * Socket.io client for the AstrBot+ companion backend.
 *
 * The handshake is authenticated: the client must already have obtained a JWT
 * via `POST /api/auth/login` (see `@/api/http.ts`), then pass it as
 * `auth: { token }` when opening the socket. Everything else travels over the
 * same connection:
 *
 * Wire protocol (client → server):
 *   chat:send      { reqId, botId, text }
 *   private:send   { reqId, toUserId, text }
 *
 * Wire protocol (server → client):
 *   chat:session   { reqId, sessionId }
 *   chat:delta     { reqId, delta }
 *   chat:done      { reqId, text, sessionId }
 *   chat:error     { reqId, message }
 *   private:message { id, reqId, fromUserId, fromUsername, toUserId, text, ts }
 *   message:new    { peerType, peerId, role, text, ts }
 *   bots:changed
 */
import { io, type Socket } from "socket.io-client";

/** Normalise a bare host[:port] or url into a Socket.io endpoint url. */
export function normalizeSocketUrl(raw: string): string {
  let value = (raw || "").trim();
  if (!value) return "";
  // Accept ws:// / wss:// and bare host[:port] alike; socket.io-client expects an
  // http(s) base url and negotiates the websocket upgrade itself.
  value = value.replace(/^wss:\/\//i, "https://").replace(/^ws:\/\//i, "http://");
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
  return value.replace(/\/+$/, "");
}

/** Generate a unique request id for correlating a chat stream. */
export function genReqId(): string {
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

export class PlusSocket {
  private url: string;
  private token: string;
  private socket: Socket | null = null;
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  private statusListeners = new Set<(s: ConnectionState) => void>();
  private status: ConnectionState = "idle";

  constructor(url: string, token = "") {
    this.url = normalizeSocketUrl(url);
    this.token = token;
  }

  /** Update the Bearer token (e.g. after a fresh login) before reconnecting. */
  setToken(token: string): void {
    this.token = token;
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
      path: "/socket.io",
      auth: { token: this.token },
      // Engine.IO default order: start with long-polling, then upgrade to a
      // websocket — the most compatible behaviour across flaky networks.
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

  /**
   * Send a chat message to an Agent and stream the reply.
   *
   * Returns a synchronous unsubscribe function. Delivery failure surfaces
   * through `handlers.onError`.
   */
  sendChat(
    payload: { text: string; botId: string },
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
        handlers.onDone?.(d.text ?? full, d.sessionId ?? null);
      }),
      this.on("chat:error", (raw) => {
        const d = raw as { reqId?: string; message?: string };
        if (d?.reqId !== reqId || done) return;
        done = true;
        handlers.onError?.(new Error(d.message ?? "未知错误"));
      }),
    ];

    void (async () => {
      try {
        const socket = await this.ensureConnected();
        socket.timeout(15000).emit(
          "chat:send",
          { reqId, botId: payload.botId, text: payload.text },
          () => {
            /* ack optional */
          },
        );
      } catch (e) {
        if (!done) {
          done = true;
          handlers.onError?.(e instanceof Error ? e : new Error(String(e)));
        }
      }
    })();

    return () => offs.forEach((off) => off());
  }

  /**
   * Send a one-to-one private message to another user. Returns the reqId so
   * the caller can correlate the server's `private:message` echo.
   */
  async sendPrivate(toUserId: string, text: string): Promise<string> {
    const reqId = genReqId();
    const socket = await this.ensureConnected();
    socket.timeout(15000).emit(
      "private:send",
      { reqId, toUserId, text },
      () => {
        /* ack optional */
      },
    );
    return reqId;
  }

  private async ensureConnected(): Promise<Socket> {
    if (!this.socket?.connected) await this.connect();
    if (!this.socket) throw new Error("Socket 未连接");
    return this.socket;
  }
}
