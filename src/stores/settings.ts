import { defineStore } from "pinia";
import { computed, reactive, ref, watch } from "vue";
import { usePreferredDark, useStorage } from "@vueuse/core";
import { AstrbotClient, isTauri } from "@/api/client";
import type { ProviderInfo } from "@/api/types";

const STORAGE_KEY = "astrbot-plus.settings";

export interface PersistedSettings {
  baseUrl: string;
  apiKey: string;
  /** WebSocket endpoint of the astrbot_plugin_plus adapter, e.g. ws://ip:6199/ws */
  wsUrl: string;
  /** Optional token the plugin may require (?token=...). */
  wsToken: string;
  theme: "system" | "astrbotDark" | "astrbotLight";
  notifyEnabled: boolean;
  notifyOnlyBackground: boolean;
  minimizeToTray: boolean;
  closeToTray: boolean;
  autoStart: boolean;
  pollIntervalSec: number;
}

const DEFAULT_SETTINGS: PersistedSettings = {
  // No default server: the user must enter their own AstrBot endpoint so we
  // never hard-code or leak a third-party address into the app.
  baseUrl: "",
  apiKey: "",
  wsUrl: "",
  wsToken: "",
  theme: "astrbotDark",
  notifyEnabled: true,
  notifyOnlyBackground: true,
  minimizeToTray: true,
  closeToTray: true,
  autoStart: false,
  pollIntervalSec: 20,
};

export const useSettingsStore = defineStore("settings", () => {
  // Settings are persisted in localStorage so they survive app restarts.
  // (The API key could also be moved to the OS keychain via a Tauri plugin.)
  const stored = useStorage<PersistedSettings>(STORAGE_KEY, DEFAULT_SETTINGS);
  const settings = reactive<PersistedSettings>({ ...DEFAULT_SETTINGS, ...stored.value });

  const connected = ref(false);
  const connecting = ref(false);
  const lastError = ref<string>("");
  const providers = ref<ProviderInfo[]>([]);
  const botIds = ref<string[]>([]);

  const preferredDark = usePreferredDark();
  const isDark = computed(() => {
    if (settings.theme === "system") return preferredDark.value;
    return settings.theme === "astrbotDark";
  });

  function persist() {
    stored.value = { ...settings };
  }

  watch(settings, persist, { deep: true });

  function buildClient(): AstrbotClient {
    return new AstrbotClient({ baseUrl: settings.baseUrl, apiKey: settings.apiKey });
  }

  async function testConnection(): Promise<boolean> {
    connecting.value = true;
    lastError.value = "";
    try {
      const client = buildClient();
      const bots = await client.listImBots();
      botIds.value = bots;
      providers.value = await client.listProviders().catch(() => []);
      connected.value = true;
      return true;
    } catch (e) {
      connected.value = false;
      lastError.value = e instanceof Error ? e.message : String(e);
      return false;
    } finally {
      connecting.value = false;
    }
  }

  function cycleTheme() {
    settings.theme = isDark.value ? "astrbotLight" : "astrbotDark";
  }

  function reset() {
    Object.assign(settings, DEFAULT_SETTINGS);
  }

  const hasCredentials = computed(() => !!settings.baseUrl && !!settings.apiKey);

  return {
    settings,
    connected,
    connecting,
    lastError,
    providers,
    botIds,
    isDark,
    hasCredentials,
    isTauri: isTauri(),
    testConnection,
    buildClient,
    cycleTheme,
    reset,
  };
});
