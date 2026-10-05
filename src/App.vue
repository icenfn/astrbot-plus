<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from "vue";
import { useTheme } from "vuetify";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import { useSettingsStore } from "@/stores/settings";
import { useChatStore } from "@/stores/chat";
import { usePlatform } from "@/composables/usePlatform";
import { useVisualViewport } from "@/composables/useVisualViewport";
import { useWindow } from "@/composables/useWindow";
import AppSidebar from "@/components/AppSidebar.vue";
import AppMobileNav from "@/components/AppMobileNav.vue";

const theme = useTheme();
const router = useRouter();
const settings = useSettingsStore();
const chat = useChatStore();
const { isDark } = storeToRefs(settings);
const { isMobile } = usePlatform();
const { installCloseHandler } = useWindow();

// Keep the app shell pinned to the visual viewport (keyboard-safe).
useVisualViewport();

// Keep the Vuetify theme in sync with the settings store.
watch(
  isDark,
  (dark) => theme.change(dark ? "astrbotDark" : "astrbotLight"),
  { immediate: true },
);

// Android hardware back button: the native MainActivity dispatches an
// `android:back` event. When a conversation is open, close it; otherwise
// fall back to the chats tab.
function onAndroidBack() {
  if (chat.activeUmo) {
    chat.activeUmo = "";
    return;
  }
  if (router.currentRoute.value.name !== "chats") router.push("/");
}

// Refresh the list (and poll for new messages) whenever a conversation closes
// so the unread badges stay accurate.
watch(
  () => chat.activeUmo,
  (umo) => {
    if (!umo) void chat.loadContacts({ detectNew: true });
  },
);

onMounted(async () => {
  if (settings.hasCredentials) {
    const ok = await settings.testConnection();
    if (ok) {
      await chat.loadContacts();
      chat.startPolling();
    }
  }
  // Desktop: run in the background (hide instead of quitting) on close.
  installCloseHandler({ closeToTray: settings.settings.closeToTray });
  window.addEventListener("android:back", onAndroidBack);
});

onBeforeUnmount(() => {
  chat.stopPolling();
  window.removeEventListener("android:back", onAndroidBack);
});
</script>

<template>
  <v-app>
    <div class="app-shell" :class="{ 'is-mobile': isMobile }">
      <AppSidebar v-if="!isMobile" />
      <div class="app-view">
        <router-view />
      </div>
      <!-- The bottom tab bar is hidden while a conversation is open: the message
           view is a full-screen page on mobile. -->
      <AppMobileNav v-if="isMobile && !chat.activeUmo" />
    </div>
  </v-app>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: row;
  height: 100vh;
  /* --app-height mirrors window.visualViewport.height so the layout shrinks
     when the on-screen keyboard opens. */
  height: var(--app-height, 100dvh);
  width: 100vw;
  overflow: hidden;
}
.app-shell.is-mobile {
  flex-direction: column;
}
.app-view {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
</style>
