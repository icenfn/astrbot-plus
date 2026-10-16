<script setup lang="ts">
import { onMounted, watch } from "vue";
import { useEventListener } from "@vueuse/core";
import { useTheme } from "vuetify";
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";
import { useSettingsStore } from "@/stores/settings";
import { useChatStore } from "@/stores/chat";
import { useVisualViewport } from "@/composables/useVisualViewport";
import { useWindow } from "@/composables/useWindow";
import { useHomeTabs } from "@/composables/useHomeTabs";
import {
  requestBackgroundRun,
  requestNotificationPermission,
} from "@/composables/useBackground";

/**
 * App shell — global, frame-less concerns only.
 *
 * The page chrome (application bar, side rail, tab bar, back button) now lives
 * in the vue-router LAYOUT components (HomeLayout / MessageLayout / BackLayout),
 * not here. App.vue only keeps truly global behaviour: pinning to the visual
 * viewport, theme sync, the route ⇄ active-Agent sync, the socket lifecycle,
 * notifications/background running, and the Android hardware back button.
 */
const theme = useTheme();
const route = useRoute();
const router = useRouter();
const settings = useSettingsStore();
const chat = useChatStore();
const { isDark, connected } = storeToRefs(settings);
const { activeKey } = storeToRefs(chat);
const { installCloseHandler } = useWindow();
const { activeHomeTab, selectTab } = useHomeTabs();

// Keep the app shell pinned to the visual viewport (keyboard-safe).
useVisualViewport();

// Keep the Vuetify theme in sync with the settings store.
watch(
  isDark,
  (dark) => {
    theme.change(dark ? "telegramDark" : "telegramLight");
    // Keep the Android status / navigation bar icons legible against the app
    // surface (light surface ⇒ dark icons). No-op on desktop/web where the
    // bridge is absent.
    (
      window as unknown as {
        AstrbotNative?: { setStatusBarAppearance?: (light: boolean) => void };
      }
    ).AstrbotNative?.setStatusBarAppearance?.(!dark);
  },
  { immediate: true },
);

// ---- Route ⇄ active Agent sync ------------------------------------------
// The open conversation is route-driven (`/chat/:id`). Keeping the route as the
// single source of truth is what makes leaving a chat reliable: the header back
// button and the Android hardware back button both just move the route, and the
// chat store follows.
function routeId(): string {
  return typeof route.params.id === "string" ? route.params.id : "";
}

watch(
  routeId,
  (id) => {
    if (id === chat.activeKey) return;
    if (id) chat.openAgent(id);
    else chat.closeActive();
  },
  { immediate: true },
);

// Reverse direction: an Agent selected elsewhere (e.g. a system notification)
// updates the URL. Guarded on both sides so the two watchers settle without
// ping-ponging.
watch(activeKey, (key) => {
  const id = routeId();
  if (key === id) return;
  if (key) void router.replace(`/chat/${key}`);
  else if (id) void router.replace("/");
});

// Android hardware back button: close an open conversation first, then leave
// any non-tab page back to the home tab.
function onAndroidBack(): void {
  // 1) An open conversation → back to the 首页 frame (the chat store follows the route).
  if (activeKey.value) {
    void router.push("/");
    return;
  }
  // 2) Any secondary page (设置 / 关于 / Agent 信息 …) → back to the 首页 frame.
  if (route.name !== "chats") {
    void router.push("/");
    return;
  }
  // 3) On the 首页 frame: first return to the primary (消息) tab; if we are already
  //    on it, hand the back press to Android so the app goes to the launcher WITHOUT
  //    being finished —「从 app 回到桌面，app 不退出不关闭」.
  if (activeHomeTab.value !== "chats") {
    selectTab("chats");
    return;
  }
  (
    window as unknown as { AstrbotNative?: { moveToBackground?: () => void } }
  ).AstrbotNative?.moveToBackground?.();
}

// Android 硬件返回键：交给 @vueuse/core，组件卸载时自动解绑。
useEventListener(window, "android:back", onAndroidBack);

// Once connected, bind the real-time message feed so the list updates live even
// while another tab is open. Background-running / notification permissions are
// requested ON DEMAND (see the watchers below), never automatically on launch —
// the user must opt in, so a cold start never raises the system prompt.
watch(
  connected,
  (ok) => {
    if (ok) {
      chat.bindFeed();
      void chat.loadContacts();
    }
  },
  { immediate: true },
);

// Background running: request the OS permission only when the user turns the
// option ON (the default is ON, so a value change here means a deliberate tap).
watch(
  () => settings.settings.backgroundRun,
  (on) => {
    if (on && connected.value) void requestBackgroundRun();
  },
);

// Notifications: request POST_NOTIFICATIONS (Android) only when the user turns
// notifications ON, so the prompt never appears on a cold start.
watch(
  () => settings.settings.notifyEnabled,
  (on) => {
    if (on) void requestNotificationPermission();
  },
);

// Refresh the list whenever a chat closes so the unread badges stay accurate.
watch(
  () => activeKey.value,
  (key) => {
    if (!key) void chat.loadContacts();
  },
);

onMounted(async () => {
  // Restore cached session ids (SQLite) before connecting.
  void chat.restoreCache();
  if (settings.hasCredentials) {
    const ok = await settings.connect();
    if (ok) await chat.loadContacts();
  }
  // Desktop: run in the background (hide instead of quitting) on close.
  installCloseHandler({ closeToTray: settings.settings.closeToTray });
});
</script>

<template>
  <v-app>
    <div class="app-shell">
      <router-view />
    </div>
  </v-app>
</template>

<style scoped>
.app-shell {
  /* Pinned to the *visual* viewport. useVisualViewport() writes
     --app-height / --app-offset-top from window.visualViewport, so when the
     on-screen keyboard opens the shell shrinks to the visible area and is offset
     below the (optional) top bar — the composer then always sits directly above
     the keyboard instead of being covered by it. */
  position: fixed;
  top: var(--app-offset-top, 0px);
  left: 0;
  right: 0;
  width: 100%;
  height: var(--app-height, 100dvh);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgb(var(--v-theme-surface));
}
</style>
