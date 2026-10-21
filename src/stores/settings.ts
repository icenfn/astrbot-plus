/**
 * Settings store — connection endpoint, credentials, appearance and prefs.
 *
 * The client talks to a HTTP+Socket.io backend:
 *
 *   • baseURL  — `host:port` entered in the wizard (normalized to http(s)).
 *   • email / password — used once to exchange for a JWT via
 *     `POST /api/auth/login`; the JWT is then sent as `Authorization: Bearer`
 *     on every HTTP call and as `auth: { token }` on the Socket.io handshake.
 *
 * Everything is persisted to localStorage.
 */
import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { useTheme } from "vuetify";
import { PlusSocket, type ConnectionState, type SocketIOMode } from "@/api/socket";
import { login as loginApi, type LoginUser } from "@/api/http";
import { THEME_NAMES } from "@/plugins/theme";

export type ThemeMode = "system" | "dark" | "light";

interface SettingsState {
  /** Backend base URL (host[:port], normalized at use-site). */
  serverUrl: string;
  /** Login credentials. */
  email: string;
  password: string;
  /** JWT returned by POST /api/auth/login. */
  jwtToken: string;
  /** Authenticated user profile. */
  currentUser: LoginUser | null;
  // ---- appearance / prefs -------------------------------------------------
  theme: ThemeMode;
  autoStart: boolean;
  closeToTray: boolean;
  minimizeToTray: boolean;
  notifyEnabled: boolean;
  notifyOnlyBackground: boolean;
  /** Android: request the OS to keep the app alive in the background. */
  backgroundRun: boolean;
}

const STORAGE_KEY = "astrbot-plus.settings";

const DEFAULTS: SettingsState = {
  serverUrl: "",
  email: "",
  password: "",
  jwtToken: "",
  currentUser: null,
  theme: "system",
  autoStart: false,
  closeToTray: true,
  minimizeToTray: true,
  notifyEnabled: true,
  notifyOnlyBackground: true,
  backgroundRun: true,
};

function load(): SettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as Record<string, unknown>;
      // 兼容历史主题名（v0.4.x 之前存过 astrbotDark/Light、telegramDark/Light）。
      const LEGACY: Record<string, ThemeMode> = {
        astrbotDark: "dark",
        astrbotLight: "light",
        telegramDark: "dark",
        telegramLight: "light",
      };
      if (typeof data.theme === "string" && LEGACY[data.theme]) {
        data.theme = LEGACY[data.theme];
      }
      // 兼容旧字段 socketUrl → serverUrl。
      if (!data.serverUrl && typeof data.socketUrl === "string") {
        data.serverUrl = data.socketUrl;
      }
      return { ...DEFAULTS, ...(data as Partial<SettingsState>) };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return { ...DEFAULTS };
}

/**
 * Parse a quick-connect URL of the form
 *   ap://email:password@host:port
 *
 * Rules:
 *   1. strip the `ap://` prefix (case-insensitive).
 *   2. split on the LAST `@` → left = userinfo, right = host[:port].
 *   3. split userinfo on the FIRST `:` → email, password.
 *
 * Returns null when the shape doesn't match (caller falls back to manual).
 */
export function parseQuickConnect(
  raw: string,
): { serverUrl: string; email: string; password: string } | null {
  let s = (raw || "").trim();
  if (!s) return null;
  s = s.replace(/^ap:\/\//i, "");
  if (!s) return null;
  const at = s.lastIndexOf("@");
  if (at <= 0 || at >= s.length - 1) return null;
  const userinfo = s.slice(0, at);
  const host = s.slice(at + 1).trim();
  if (!host) return null;
  const colon = userinfo.indexOf(":");
  if (colon <= 0 || colon >= userinfo.length - 1) return null;
  const email = userinfo.slice(0, colon).trim();
  const password = userinfo.slice(colon + 1);
  if (!email || !password) return null;
  return { serverUrl: host, email, password };
}

export const useSettingsStore = defineStore("settings", () => {
  const settings = ref<SettingsState>(load());
  const connected = ref(false);
  const connecting = ref(false);
  const lastError = ref("");
  const connectionState = ref<ConnectionState>("idle");
  const socketMode = ref<SocketIOMode>("—");

  let socket: PlusSocket | null = null;
  let modeTimer: number | undefined;

  const hasCredentials = computed(
    () => !!settings.value.serverUrl.trim() && !!settings.value.jwtToken,
  );

  // ---- persistence --------------------------------------------------------
  watch(
    () => settings.value,
    (value) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch {
        /* ignore quota errors */
      }
    },
    { deep: true },
  );

  // ---- appearance ---------------------------------------------------------
  const theme = useTheme();
  const isDark = computed(() => theme.global.current.value.dark);

  function applyTheme(): void {
    const mode = settings.value.theme;
    if (mode === "system") {
      const prefersDark =
        window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
      theme.global.name.value = prefersDark ? THEME_NAMES.dark : THEME_NAMES.light;
    } else {
      theme.global.name.value = mode === "dark" ? THEME_NAMES.dark : THEME_NAMES.light;
    }
  }
  watch(() => settings.value.theme, applyTheme, { immediate: true });

  function cycleTheme(): void {
    const order: ThemeMode[] = ["system", "dark", "light"];
    const idx = order.indexOf(settings.value.theme);
    settings.value.theme = order[(idx + 1) % order.length];
  }

  // ---- socket -------------------------------------------------------------
  function getSocket(): PlusSocket {
    if (!socket) {
      socket = new PlusSocket(settings.value.serverUrl, settings.value.jwtToken);
    }
    return socket;
  }

  /** Keep the exported connection state / socket.io mode in sync with the socket. */
  function bindStatus(s: PlusSocket): void {
    s.onStatus((state) => {
      connectionState.value = state;
      connected.value = state === "connected";
    });
    if (modeTimer) window.clearInterval(modeTimer);
    modeTimer = window.setInterval(() => {
      socketMode.value = s.mode;
    }, 1000);
    socketMode.value = s.mode;
  }

  /**
   * Exchange email/password for a JWT and store it. Does NOT open the socket.
   * Throws with a user-facing message on failure.
   */
  async function doLogin(
    email: string,
    password: string,
  ): Promise<LoginUser> {
    const res = await loginApi(email, password);
    if (!res || !res.token || !res.user) {
      throw new Error("登录响应异常");
    }
    settings.value.jwtToken = res.token;
    settings.value.currentUser = res.user;
    settings.value.email = email;
    settings.value.password = password;
    return res.user;
  }

  /**
   * (Re)connect: login with the stored email/password, then open the
   * authenticated Socket.io connection. Returns true on success.
   */
  async function connect(): Promise<boolean> {
    if (!settings.value.serverUrl.trim()) {
      lastError.value = "请先填写服务器地址";
      return false;
    }
    if (!settings.value.email.trim() || !settings.value.password) {
      lastError.value = "请先填写邮箱和密码";
      return false;
    }
    connecting.value = true;
    lastError.value = "";
    try {
      // 1) Login → JWT (skip if we already have one matching these creds).
      if (!settings.value.jwtToken) {
        await doLogin(settings.value.email, settings.value.password);
      }
      // 2) Open the authenticated socket.
      socket?.disconnect();
      socket = new PlusSocket(settings.value.serverUrl, settings.value.jwtToken);
      bindStatus(socket);
      await socket.connect();
      connected.value = true;
      connectionState.value = "connected";
      return true;
    } catch (e) {
      connected.value = false;
      const raw = e instanceof Error ? e.message : String(e);
      lastError.value = /Failed to fetch|NetworkError|load failed|fetch/i.test(raw)
        ? `${raw}（连接失败：请确认服务器地址/端口可直连、服务已启动，且网络未拦截该端口）`
        : raw;
      return false;
    } finally {
      connecting.value = false;
    }
  }

  function disconnect(): void {
    if (modeTimer) window.clearInterval(modeTimer);
    socket?.disconnect();
    socket = null;
    connected.value = false;
    connectionState.value = "idle";
    socketMode.value = "—";
  }

  /** Wipe credentials (settings → 退出登录 / 重新配置). */
  function clearCredentials(): void {
    disconnect();
    settings.value.serverUrl = "";
    settings.value.email = "";
    settings.value.password = "";
    settings.value.jwtToken = "";
    settings.value.currentUser = null;
  }

  return {
    settings,
    connected,
    connecting,
    lastError,
    connectionState,
    socketMode,
    hasCredentials,
    isDark,
    cycleTheme,
    getSocket,
    doLogin,
    connect,
    disconnect,
    clearCredentials,
  };
});
