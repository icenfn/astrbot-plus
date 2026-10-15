<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useHomeTabs } from "@/composables/useHomeTabs";

/**
 * AppTopBar — title-only application bar for the home frame.
 *
 * On the home frame the title follows the active embedded pane (消息 / 联系人 / 我的);
 * on other frames it falls back to the route's `meta.title`. On the 联系人 pane a
 * search button is shown on the right (toggling the contacts search field).
 */
const route = useRoute();
const { activeTab, activeHomeTab, searchOpen } = useHomeTabs();

const onHome = computed(() => route.name === "chats");
const title = computed(() =>
  onHome.value
    ? activeTab.value.title
    : ((route.meta.title as string | undefined) ?? "AstrBot+"),
);

function toggleSearch(): void {
  searchOpen.value = !searchOpen.value;
}
</script>

<template>
  <v-toolbar class="app-topbar" density="comfortable" flat>
    <v-toolbar-title class="app-topbar-title">{{ title }}</v-toolbar-title>
    <v-spacer />
    <v-btn
      v-if="onHome && activeHomeTab === 'contacts'"
      :icon="searchOpen ? 'mdi-close' : 'mdi-magnify'"
      variant="text"
      :ripple="false"
      class="app-topbar-action"
      :title="searchOpen ? '关闭搜索' : '搜索'"
      @click="toggleSearch"
    />
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
.app-topbar-action {
  color: rgb(var(--v-theme-on-surface));
  margin-right: 4px;
}
</style>
