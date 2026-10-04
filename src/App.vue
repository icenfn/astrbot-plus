<script setup lang="ts">
import { onMounted, watch } from "vue";
import { useTheme } from "vuetify";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "@/stores/settings";
import { useChatStore } from "@/stores/chat";
import AppSidebar from "@/components/AppSidebar.vue";
import { useWindow } from "@/composables/useWindow";

const theme = useTheme();
const settings = useSettingsStore();
const chat = useChatStore();
const { isDark } = storeToRefs(settings);
const { installCloseHandler } = useWindow();

// Keep the Vuetify theme in sync with the settings store.
watch(
  isDark,
  (dark) => theme.change(dark ? "astrbotDark" : "astrbotLight"),
  { immediate: true },
);

onMounted(async () => {
  if (settings.hasCredentials) {
    const ok = await settings.testConnection();
    if (ok) await chat.loadContacts();
  }
  // Run in the background: hide instead of quitting when the window is closed.
  installCloseHandler({ closeToTray: settings.settings.closeToTray });
});
</script>

<template>
  <v-app>
    <div class="app-shell">
      <AppSidebar />
      <div class="app-view">
        <router-view />
      </div>
    </div>
  </v-app>
</template>

<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}
.app-view {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  overflow: hidden;
}
</style>
