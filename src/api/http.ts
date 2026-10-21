/**
 * alova v3 HTTP layer for the AstrBot+ companion backend.
 *
 * The backend exposes a small JSON-over-HTTP API alongside the Socket.io feed:
 *
 *   POST /api/auth/login            { email, password } → { token, user }
 *   GET  /api/agents                Bearer              → AgentDto[]
 *   GET  /api/users                 Bearer              → UserDto[]
 *   GET  /api/messages?peerType&peerId&before&limit
 *                                   Bearer              → HistoryMessageDto[]
 *   GET  /health
 *
 * baseURL is the same `host:port` entered in the wizard (normalized to an
 * http(s) URL), and the Bearer token is injected by a global request hook
 * from the settings store — method factories below stay trivial.
 */
import { createAlova } from "alova";
import adapterFetch from "alova/fetch";
import { useSettingsStore } from "@/stores/settings";
import { normalizeSocketUrl } from "./socket";
import type { AgentRow, HistoryMessage, UserRow } from "./types";

export interface LoginUser {
  id: string;
  email: string;
  username: string;
  df?: string;
}

export interface LoginResponse {
  token: string;
  user: LoginUser;
}

/**
 * Global alova instance. `beforeRequest` resolves the live baseURL + Bearer
 * token from the settings store on every call, so the wizard can swap the
 * endpoint without rebuilding the instance.
 */
export const alovaInstance = createAlova({
  // A placeholder baseURL; the real one is injected per-request below.
  baseURL: "",
  requestAdapter: adapterFetch(),
  beforeRequest(method) {
    const settings = useSettingsStore();
    const base = normalizeSocketUrl(settings.settings.serverUrl);
    if (base) method.baseURL = base;
    const token = settings.settings.jwtToken;
    if (token) {
      method.config.headers = {
        ...(method.config.headers || {}),
        Authorization: `Bearer ${token}`,
      };
    }
  },
  responded: {
    // Unwrap a raw fetch Response into parsed JSON. Non-2xx throws an Error
    // whose message prefers the server-provided `message` / `error` field so
    // the wizard can surface "邮箱或密码错误" instead of "400 Bad Request".
    onSuccess: async (response: Response) => {
      if (!response.ok) {
        let msg = `${response.status} ${response.statusText}`;
        try {
          const body = (await response.json()) as {
            message?: string;
            error?: string;
          };
          if (body?.message) msg = body.message;
          else if (body?.error) msg = body.error;
        } catch {
          /* non-json error body — keep the status text */
        }
        throw new Error(msg);
      }
      return response.json();
    },
    onError: (error) => {
      // Network-level failure (DNS / CORS / offline). Normalise to an Error
      // so callers can read .message uniformly.
      if (error instanceof Error) throw error;
      throw new Error(String(error));
    },
  },
  // No global cache: every call goes to the network (messages are already
  // cached locally in SQLite by the chat store). GET methods below set
  // `cacheFor: 0` to disable alova's default 5-minute memory cache.
});

// ---- method factories ----------------------------------------------------

/** POST /api/auth/login — exchange email/password for a Bearer token. */
export const loginRequest = (email: string, password: string) =>
  alovaInstance.Post<LoginResponse>("/api/auth/login", { email, password });

/** GET /api/agents — the live Agent directory. */
export const listAgentsRequest = () =>
  alovaInstance.Get<AgentRow[]>("/api/agents", { cacheFor: 0 });

/** GET /api/users — friends list (self excluded). */
export const listFriendsRequest = () =>
  alovaInstance.Get<UserRow[]>("/api/users", { cacheFor: 0 });

/** GET /api/messages — paged history for one peer. */
export const fetchHistoryRequest = (
  peerType: "agent" | "user",
  peerId: string,
  before?: number,
  limit = 50,
) =>
  alovaInstance.Get<HistoryMessage[]>(
    "/api/messages",
    {
      params: { peerType, peerId, before, limit },
      cacheFor: 0,
    },
  );

/** Thin async wrappers — the store awaits these directly. */
export const login = (email: string, password: string) =>
  loginRequest(email, password);
export const listAgents = () => listAgentsRequest();
export const listFriends = () => listFriendsRequest();
export const fetchHistory = (
  peerType: "agent" | "user",
  peerId: string,
  before?: number,
  limit = 50,
) => fetchHistoryRequest(peerType, peerId, before, limit);
