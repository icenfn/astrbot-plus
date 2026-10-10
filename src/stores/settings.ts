import { defineStore } from "pinia";
import { computed, reactive, ref, shallowRef, watch } from "vue";
import { usePreferredDark, useStorage } from "@vueuse/core";
import { PlusSocket } from "@/api/socket";
import { isTauri } from "@/api/client";

const STORAGE_KEY = "astrbot-plus.settings";

export interface PersistedSettings {
  /** The companion plugin's dedicated Socket.io endpoint, e.g. http://host:6199 . */
  socketUrl: string;
  /** API key sent in the Socket.io handshake to authenticate the client. */
  accessKey: string;
  theme: "system" | "astrbotDark" | "astrbotLight";
  notifyEnabled: boolean;
  notifyOnlyBackground: boolean;
  minimizeToTray: boolean;
  closeToTray: boolean;
  autoStart: boolean;
  pollIntervalSec: number;
}

const DEFAULT_SETTINGS: PersistedSettings = {
  // No default server: the user must enter their own endpoint so we never
  // hard-code or leak a third-party address into the app.
  socketUrl: "",
  accessKey: "",
  theme: "astrbotDark",
  notifyEnabled: true,
  notifyOnlyBackground: true,
  minimizeToTray: true,
  closeToTray: true,
  autoStart: false,
  pollIntervalSec: 20,
};

export const useSettingsStore = defineStore("settings", () => {
  const stored = useStorage<PersistedSettings>(STORAGE_KEY, DEFAULT_SETTINGS);
  const settings = reactive<PersistedSettings>({ ...DEFAULT_SETTINGS, ...stored.value });

  /** The live Socket.io connection to the companion plugin. */
  const socket = shallowRef<PlusSocket | null>(null);
  const connected = ref(false);
  const connecting = ref(false);
  const lastError = ref<string>("");

  const preferredDark = usePreferredDark();
  const isDark = computed(() =>
    settings.theme === "system" ? preferredDark.value : settings.theme === "astrbotDark",
  );

  function persist() {
    stored.value = { ...settings };
  }

  watch(settings, persist, { deep: true });

  function buildSocket(): PlusSocket {
    return new PlusSocket(settings.socketUrl, settings.accessKey);
  }

  /** Return the live socket or throw — used by callers that require a connection. */
  function getSocket(): PlusSocket {
    if (!socket.value || !socket.value.connected) {
      throw new Error("尚未连接到 AstrBot+ 插件");
    }
    return socket.value;
  }

  async function connect(): Promise<boolean> {
    connecting.value = true;
    lastError.value = "";
    try {
      socket.value?.disconnect();
      const next = buildSocket();
      await next.connect();
      // Verify the handshake really reached the plugin before declaring success.
      await next.ping();
      socket.value = next;
      connected.value = true;
      return true;
    } catch (e) {
      socket.value?.disconnect();
      socket.value = null;
      connected.value = false;
      lastError.value = e instanceof Error ? e.message : String(e);
      return false;
    } finally {
      connecting.value = false;
    }
  }

  function disconnect() {
    socket.value?.disconnect();
    socket.value = null;
    connected.value = false;
  }

  function cycleTheme() {
    settings.theme = isDark.value ? "astrbotLight" : "astrbotDark";
  }

  function reset() {
    Object.assign(settings, DEFAULT_SETTINGS);
  }

  const hasCredentials = computed(() => !!settings.socketUrl);

  return {
    settings,
    socket,
    connected,
    connecting,
    lastError,
    isDark,
    hasCredentials,
    isTauri: isTauri(),
    buildSocket,
    getSocket,
    connect,
    disconnect,
    cycleTheme,
    reset,
  };
});
