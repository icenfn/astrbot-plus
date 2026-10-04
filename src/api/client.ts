import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type {
  ApiEnvelope,
  ChatMessage,
  Contact,
  Conversation,
  HistoryEntry,
  MessagePart,
  ProviderInfo,
  SessionInfo,
} from "./types";

export interface AstrbotConfig {
  baseUrl: string;
  apiKey: string;
}

/** Detect whether we are running inside a Tauri webview. */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Unified fetch that transparently uses the Tauri HTTP plugin when available
 * (so requests bypass browser CORS) and falls back to the global fetch in the
 * plain browser/dev environment.
 */
async function doFetch(input: string, init?: RequestInit): Promise<Response> {
  if (isTauri()) {
    return tauriFetch(input, init);
  }
  return fetch(input, init);
}

export class AstrbotError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "AstrbotError";
    this.status = status;
  }
}

/**
 * Thin client over the AstrBot HTTP API.
 * All endpoints live under `{baseUrl}/api/v1`.
 */
export class AstrbotClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: AstrbotConfig) {
    this.baseUrl = (config.baseUrl || "").replace(/\/+$/, "");
    this.apiKey = config.apiKey.trim();
  }

  private url(path: string): string {
    const base = this.baseUrl.endsWith("/api") ? this.baseUrl : `${this.baseUrl}/api`;
    return `${base}/v1${path}`;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "X-API-Key": this.apiKey,
      Accept: "application/json",
      ...(extra ?? {}),
    };
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await doFetch(this.url(path), {
      ...init,
      headers: this.headers(init?.headers as Record<string, string>),
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok) {
      const msg =
        (body && typeof body === "object" && "message" in (body as Record<string, unknown>)
          ? String((body as Record<string, unknown>).message)
          : "") || `${res.status} ${res.statusText}`;
      throw new AstrbotError(msg || "Request failed", res.status);
    }
    return body as T;
  }

  /** Verify credentials and return the configured IM bot ids. */
  async listImBots(): Promise<string[]> {
    const env = await this.request<ApiEnvelope<{ bot_ids: string[] }>>("/im/bots");
    return env.data?.bot_ids ?? [];
  }

  async listProviders(): Promise<ProviderInfo[]> {
    const env = await this.request<ApiEnvelope<{ providers: ProviderInfo[] }>>("/providers");
    return env.data?.providers ?? [];
  }

  async listConversations(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    platforms?: string;
    includeHistory?: boolean;
  } = {}): Promise<Conversation[]> {
    const q = new URLSearchParams();
    q.set("page", String(params.page ?? 1));
    q.set("page_size", String(params.pageSize ?? 100));
    if (params.search) q.set("search", params.search);
    if (params.platforms) q.set("platforms", params.platforms);
    q.set("include_history", params.includeHistory ? "true" : "false");
    const env = await this.request<ApiEnvelope<{ conversations: Conversation[] }>>(
      `/conversations?${q.toString()}`,
    );
    return env.data?.conversations ?? [];
  }

  async listSessions(params: { platform?: string; search?: string } = {}): Promise<SessionInfo[]> {
    const q = new URLSearchParams();
    if (params.platform) q.set("platform", params.platform);
    if (params.search) q.set("search", params.search);
    const env = await this.request<ApiEnvelope<{ sessions: SessionInfo[] }>>(
      `/sessions?${q.toString()}`,
    );
    return env.data?.sessions ?? [];
  }

  async getConversation(cid: string, userId: string): Promise<Conversation> {
    const q = new URLSearchParams({ user_id: userId });
    return this.request<Conversation>(`/conversations/${encodeURIComponent(cid)}?${q.toString()}`);
  }

  /** Upload a file and return its attachment id (used for image/file parts). */
  async uploadFile(file: File): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    const res = await doFetch(this.url("/file"), {
      method: "POST",
      headers: this.headers(), // do not set content-type; let the runtime add boundary
      body: form,
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) throw new AstrbotError(body?.message || "Upload failed", res.status);
    return body?.data?.attachment_id ?? body?.data?.id ?? "";
  }

  /**
   * Send a text message and stream the assistant reply.
   * Yields each incremental text delta via `onDelta`, and resolves when done.
   */
  async chatStream(
    params: {
      username: string;
      message: string;
      sessionId?: string;
      conversationId?: string;
    },
    handlers: {
      onDelta?: (delta: string, full: string) => void;
      onSessionId?: (sessionId: string) => void;
      onRunId?: (runId: string) => void;
      onTokens?: (tokens: { input?: number; output?: number }) => void;
      signal?: AbortSignal;
    } = {},
  ): Promise<string> {
    const body: Record<string, unknown> = {
      username: params.username,
      message: params.message,
      enable_streaming: true,
    };
    if (params.sessionId) body.session_id = params.sessionId;
    if (params.conversationId) body.conversation_id = params.conversationId;

    const res = await doFetch(this.url("/chat"), {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
      signal: handlers.signal,
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      let msg = `${res.status} ${res.statusText}`;
      try {
        msg = JSON.parse(text)?.message || msg;
      } catch {
        /* ignore */
      }
      throw new AstrbotError(msg, res.status);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line || !line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        let evt: Record<string, unknown>;
        try {
          evt = JSON.parse(payload);
        } catch {
          continue;
        }
        const type = String(evt.type ?? "");
        if (type === "session_id" && typeof evt.session_id === "string") {
          handlers.onSessionId?.(evt.session_id);
        } else if (type === "run_started") {
          const d = evt.data as Record<string, unknown> | undefined;
          if (d && typeof d.run_id === "string") handlers.onRunId?.(d.run_id);
        } else if (type === "plain") {
          // `data` holds the incremental chunk; `streaming` true while streaming.
          const chunk = typeof evt.data === "string" ? evt.data : "";
          if (chunk) {
            full += chunk;
            handlers.onDelta?.(chunk, full);
          }
        } else if (type === "complete") {
          const d = typeof evt.data === "string" ? evt.data : "";
          // `complete` carries the full answer; if we never streamed deltas, use it.
          if (!full && d) {
            full = d;
            handlers.onDelta?.(d, full);
          }
        } else if (type === "agent_stats") {
          const d = evt.data as Record<string, unknown> | undefined;
          const usage = d?.token_usage as Record<string, number> | undefined;
          if (usage) {
            handlers.onTokens?.({
              input: (usage.input_other ?? 0) + (usage.input_cached ?? 0),
              output: usage.output ?? 0,
            });
          }
        } else if (type === "error") {
          const msg = typeof evt.data === "string" ? evt.data : "聊天出错";
          throw new AstrbotError(msg);
        }
      }
    }
    return full;
  }

  /** Push a proactive text message to an existing conversation (imo push). */
  async sendImMessage(umo: string, message: string): Promise<void> {
    await this.request("/im/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ umo, message, type: "plain" }),
    });
  }
}

/** Parse a conversation's history (string or array) into chat bubbles. */
export function parseHistory(conversation: Conversation | undefined | null): ChatMessage[] {
  if (!conversation?.history) return [];
  let entries: HistoryEntry[] = [];
  try {
    entries =
      typeof conversation.history === "string"
        ? (JSON.parse(conversation.history) as HistoryEntry[])
        : conversation.history;
  } catch {
    return [];
  }
  const messages: ChatMessage[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.role === "_checkpoint" || entry.role === "system") continue;
    const role: ChatMessage["role"] = entry.role === "assistant" ? "assistant" : "user";
    const parts = Array.isArray(entry.content) ? entry.content : [];
    const text = parts
      .filter((p): p is MessagePart => !!p && typeof p === "object")
      .map((p) => p.text ?? "")
      .join("")
      // Strip the injected <system_reminder> breadcrumb from user turns.
      .replace(/<system_reminder>[\s\S]*?<\/system_reminder>/g, "")
      .trim();
    if (!text) continue;
    messages.push({
      role,
      text,
      created_at: "",
    });
  }
  return messages;
}

/** Turn a raw conversation row into a UI contact. */
export function toContact(c: Conversation): Contact {
  const info = c.umo_info;
  return {
    umo: c.user_id || info?.umo || c.cid,
    cid: c.cid,
    displayName: c.title || info?.display_name || info?.auto_name || c.cid,
    platform: c.platform_id || info?.platform || "unknown",
    messageType: info?.message_type || "FriendMessage",
    username: info?.creator_sender_id || info?.display_name || "webchat",
    avatarSeed: info?.display_name || c.cid,
    updatedAt: c.updated_at || 0,
  };
}

export function uid(prefix = "c"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
