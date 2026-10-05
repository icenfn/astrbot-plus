import { createAlova } from "alova";
import VueHook from "alova/vue";
import adapterFetch from "alova/fetch";
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
const baseFetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  return isTauri()
    ? (tauriFetch as unknown as typeof fetch)(input as string, init)
    : fetch(input, init);
}) as typeof fetch;

export class AstrbotError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "AstrbotError";
    this.status = status;
  }
}

function safeJson(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function envelopeMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in (body as Record<string, unknown>)) {
    const m = (body as Record<string, unknown>).message;
    if (m) return String(m);
  }
  return fallback;
}

/**
 * Create an alova instance bound to a base URL + auth headers.
 * `responded` unwraps the JSON body and surfaces HTTP errors as AstrbotError.
 */
function createInstance(baseURL: string, headers: Record<string, string>) {
  return createAlova({
    baseURL,
    statesHook: VueHook,
    requestAdapter: adapterFetch({ customFetch: baseFetch }),
    timeout: 30000,
    beforeRequest(method) {
      method.config.headers = { ...(method.config.headers ?? {}), ...headers };
    },
    responded: {
      onSuccess: async (response: Response) => {
        const text = await response.text();
        const body = safeJson(text);
        if (!response.ok) {
          throw new AstrbotError(
            envelopeMessage(body, `${response.status} ${response.statusText}`),
            response.status,
          );
        }
        return body;
      },
      onError: (error: Error) => {
        throw error instanceof AstrbotError
          ? error
          : new AstrbotError(error?.message || "Network error");
      },
    },
  });
}

/**
 * A separate instance for the streaming `/chat` endpoint. It returns the raw
 * Response so the SSE body can be read incrementally.
 */
function createStreamInstance(baseURL: string, headers: Record<string, string>) {
  return createAlova({
    baseURL,
    statesHook: VueHook,
    requestAdapter: adapterFetch({ customFetch: baseFetch }),
    // No timeout: a streaming completion may legitimately run for a long time.
    timeout: 0,
    beforeRequest(method) {
      method.config.headers = { ...(method.config.headers ?? {}), ...headers };
    },
    responded: {
      onSuccess: async (response: Response) => {
        if (!response.ok || !response.body) {
          const text = await response.text().catch(() => "");
          throw new AstrbotError(
            envelopeMessage(safeJson(text), `${response.status} ${response.statusText}`),
            response.status,
          );
        }
        return response;
      },
      onError: (error: Error) => {
        throw error instanceof AstrbotError
          ? error
          : new AstrbotError(error?.message || "Network error");
      },
    },
  });
}

/**
 * Thin client over the AstrBot HTTP API (built on alova).
 * All endpoints live under `{baseUrl}/api/v1`.
 */
export class AstrbotClient {
  private baseUrl: string;
  private apiKey: string;
  private alova: ReturnType<typeof createInstance>;
  private streamAlova: ReturnType<typeof createStreamInstance>;

  constructor(config: AstrbotConfig) {
    this.baseUrl = (config.baseUrl || "").replace(/\/+$/, "");
    this.apiKey = config.apiKey.trim();
    const base = this.baseUrl.endsWith("/api") ? this.baseUrl : `${this.baseUrl}/api`;
    const v1 = `${base}/v1`;
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      "X-API-Key": this.apiKey,
      Accept: "application/json",
    };
    this.alova = createInstance(v1, headers);
    this.streamAlova = createStreamInstance(v1, headers);
  }

  /** Verify credentials and return the configured IM bot ids. */
  async listImBots(): Promise<string[]> {
    const env = (await this.alova.Get("/im/bots").send()) as ApiEnvelope<{ bot_ids: string[] }>;
    return env?.data?.bot_ids ?? [];
  }

  async listProviders(): Promise<ProviderInfo[]> {
    const env = (await this.alova.Get("/providers").send()) as ApiEnvelope<{
      providers: ProviderInfo[];
    }>;
    return env?.data?.providers ?? [];
  }

  async listConversations(
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      platforms?: string;
      includeHistory?: boolean;
    } = {},
  ): Promise<Conversation[]> {
    const env = (await this.alova
      .Get("/conversations", {
        params: {
          page: params.page ?? 1,
          page_size: params.pageSize ?? 100,
          ...(params.search ? { search: params.search } : {}),
          ...(params.platforms ? { platforms: params.platforms } : {}),
          include_history: params.includeHistory ? "true" : "false",
        },
      })
      .send()) as ApiEnvelope<{ conversations: Conversation[] }>;
    return env?.data?.conversations ?? [];
  }

  async listSessions(params: { platform?: string; search?: string } = {}): Promise<SessionInfo[]> {
    const env = (await this.alova
      .Get("/sessions", {
        params: {
          ...(params.platform ? { platform: params.platform } : {}),
          ...(params.search ? { search: params.search } : {}),
        },
      })
      .send()) as ApiEnvelope<{ sessions: SessionInfo[] }>;
    return env?.data?.sessions ?? [];
  }

  /**
   * Fetch a single conversation (including its full history).
   * The detail endpoint requires `user_id` (the conversation's umo) and wraps
   * the payload in the standard `{status, message, data}` envelope — this
   * method unwraps `data` so callers get a plain Conversation.
   */
  async getConversation(cid: string, userId: string): Promise<Conversation> {
    const env = (await this.alova
      .Get(`/conversations/${encodeURIComponent(cid)}`, { params: { user_id: userId } })
      .send()) as ApiEnvelope<Conversation> | Conversation;
    return ((env as ApiEnvelope<Conversation>)?.data ?? env) as Conversation;
  }

  /**
   * Delete a conversation.
   * AstrBot exposes `DELETE /api/v1/conversations/{cid}` and requires the
   * conversation's `user_id` (the umo) as a query parameter.
   */
  async deleteConversation(cid: string, userId: string): Promise<void> {
    await this.alova
      .Delete(`/conversations/${encodeURIComponent(cid)}`, { params: { user_id: userId } })
      .send();
  }

  /** Upload a file and return its attachment id (used for image/file parts). */
  async uploadFile(file: File): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    const body = (await this.alova.Post("/file", form).send()) as {
      data?: { attachment_id?: string; id?: string };
    };
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

    const res = (await this.streamAlova.Post("/chat", body).send()) as unknown as Response;
    if (!res.body) throw new AstrbotError("Empty response body", res.status);

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
    await this.alova.Post("/im/messages", { umo, message, type: "plain" }).send();
  }
}

/** Strip the injected <system_reminder> breadcrumb from a user turn. */
function cleanText(parts: MessagePart[]): string {
  return parts
    .filter((p): p is MessagePart => !!p && typeof p === "object")
    .map((p) => p.text ?? "")
    .join("")
    .replace(/<system_reminder>[\s\S]*?<\/system_reminder>/g, "")
    .trim();
}

function entryText(entry: HistoryEntry): string {
  const content = entry?.content;
  if (Array.isArray(content)) return cleanText(content as MessagePart[]);
  if (typeof content === "string") return content.trim();
  return "";
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
    const text = entryText(entry);
    if (!text) continue;
    messages.push({ role, text, created_at: "" });
  }
  return messages;
}

/**
 * Summarize a conversation's history: how many real messages it has and the
 * latest message text (used for the chat-list subtitle and the unread badge).
 */
export function summarizeHistory(conversation: Conversation | undefined | null): {
  count: number;
  lastText: string;
  lastRole: ChatMessage["role"] | "";
} {
  const messages = parseHistory(conversation);
  if (!messages.length) return { count: 0, lastText: "", lastRole: "" };
  const last = messages[messages.length - 1];
  return { count: messages.length, lastText: last.text, lastRole: last.role };
}

/** Turn a raw conversation row into a UI contact. */
export function toContact(c: Conversation): Contact {
  const info = c.umo_info;
  const summary = summarizeHistory(c);
  return {
    umo: c.user_id || info?.umo || c.cid,
    // The detail endpoint needs the conversation's own user_id (the umo).
    userId: c.user_id || info?.umo || "",
    cid: c.cid,
    displayName: c.title || info?.display_name || info?.auto_name || c.cid,
    platform: c.platform_id || info?.platform || "unknown",
    messageType: info?.message_type || "FriendMessage",
    username: info?.creator_sender_id || info?.display_name || "webchat",
    avatarSeed: info?.display_name || c.cid,
    updatedAt: c.updated_at || 0,
    lastMessage: summary.lastText,
    messageCount: summary.count,
  };
}

export function uid(prefix = "c"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
