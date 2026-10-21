<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useHomeTabs } from "@/composables/useHomeTabs";

/**
 * AppTopBar — title-only application bar for the home frame.
 *
 * On the home frame the title follows the active embedded pane (消息 / 联系人 / 我的);
 * on other frames it falls back to the route's `meta.title`.
 */
const route = useRoute();
const { activeTab } = useHomeTabs();

const onHome = computed(() => route.name === "chats");
const title = computed(() =>
  onHome.value
    ? activeTab.value.title
    : ((route.meta.title as string | undefined) ?? "AstrBot+"),
);
</script>

<template>
  <v-toolbar class="app-topbar" density="comfortable" flat>
    <v-toolbar-title class="app-topbar-title">{{ title }}</v-toolbar-title>
  </v-toolbar>
</template>

<style scoped>
.app-topbar {
  flex: 0 0 auto;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
}
.app-topbar-title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0;
}
</style>
