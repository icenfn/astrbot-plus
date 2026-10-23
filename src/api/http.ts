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
 * 任一受保护接口返回 401 时，会清空本地 Bearer token（保留服务器地址与账号），
 * 使客户端回到重新登录状态。
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
  /** 头像（data-URI 或 URL）；空串表示使用内置默认头像。 */
  avatar?: string;
  /** 用户对外 ID（ap_ 前缀，唯一）。 */
  ap_id?: string;
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
        // 401 表示 Bearer token 已失效（例如服务端把 token 有效期配置为较短
        // 天数，或已过期）。此时只清空 token、保留服务器地址与账号，让界面回到
        // 「重新登录」状态，避免带着失效凭据反复请求；登录失败时不会走到这里，
        // 因为那时本地还没有 token。
        if (response.status === 401) {
          try {
            const settings = useSettingsStore();
            if (settings.settings.jwtToken) {
              settings.settings.jwtToken = "";
            }
          } catch {
            /* pinia 尚未就绪时忽略，交由调用方处理错误 */
          }
        }
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
