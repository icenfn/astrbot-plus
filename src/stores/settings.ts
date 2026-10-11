/**
 * Settings store — connection endpoint, appearance and app preferences.
 *
 * The client talks to the companion plugin (`astrbot_plugin_plus`) over a single
 * Socket.io connection, so "connection" here is just the plugin address — no
 * access key is required. Everything is persisted to localStorage.
 */
import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { useTheme } from "vuetify";
import { PlusSocket, type ConnectionState, type SocketIOMode } from "@/api/socket";

export type ThemeMode = "system" | "telegramDark" | "telegramLight";

interface SettingsState {
  socketUrl: string;
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
  socketUrl: "",
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
      // Migrate pre-0.4 theme names to the Telegram palette.
      if (data.theme === "astrbotDark") data.theme = "telegramDark";
      if (data.theme === "astrbotLight") data.theme = "telegramLight";
      return { ...DEFAULTS, ...(data as Partial<SettingsState>) };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return { ...DEFAULTS };
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

  const hasCredentials = computed(() => !!settings.value.socketUrl.trim());

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
      theme.global.name.value = prefersDark ? "telegramDark" : "telegramLight";
    } else {
      theme.global.name.value = mode;
    }
  }
  watch(() => settings.value.theme, applyTheme, { immediate: true });

  function cycleTheme(): void {
    const order: ThemeMode[] = ["system", "telegramDark", "telegramLight"];
    const idx = order.indexOf(settings.value.theme);
    settings.value.theme = order[(idx + 1) % order.length];
  }

  // ---- socket -------------------------------------------------------------
  function getSocket(): PlusSocket {
    if (!socket) {
      socket = new PlusSocket(settings.value.socketUrl);
    }
    return socket;
  }

  /** Keep the exported connection state / socket.io mode in sync with the socket. */
  function bindStatus(s: PlusSocket): void {
    s.onStatus((state) => {
      connectionState.value = state;
      connected.value = state === "connected";
    });
    // Engine.IO only reveals the active transport after connection; poll briefly
    // so the "socket.io 连接模式" chip reflects websocket vs long-polling.
    if (modeTimer) window.clearInterval(modeTimer);
    modeTimer = window.setInterval(() => {
      socketMode.value = s.mode;
    }, 1000);
    socketMode.value = s.mode;
  }

  /** (Re)connect to the plugin; rebuilds the socket if the endpoint changed. */
  async function connect(): Promise<boolean> {
    if (!hasCredentials.value) {
      lastError.value = "请先填写插件服务器地址";
      return false;
    }
    connecting.value = true;
    lastError.value = "";
    try {
      socket?.disconnect();
      socket = new PlusSocket(settings.value.socketUrl);
      bindStatus(socket);
      await socket.connect();
      await socket.ping();
      connected.value = true;
      connectionState.value = "connected";
      return true;
    } catch (e) {
      connected.value = false;
      const raw = e instanceof Error ? e.message : String(e);
      // Turn the opaque socket.io "websocket error" into an actionable hint.
      lastError.value = /websocket error|transport error|xhr poll error|connect_error/i.test(raw)
        ? `${raw}（与插件的连接失败：请确认插件地址/端口可直连、插件已启动，且网络未拦截该端口）`
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
    connect,
    disconnect,
  };
});
