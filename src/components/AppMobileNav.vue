<script setup lang="ts">
import { useHomeTabs } from "@/composables/useHomeTabs";

/**
 * Mobile bottom tab bar.
 *
 * The three tabs (消息 / 联系人 / 我的) switch the embedded panes inside HomeLayout
 * via `useHomeTabs`, so the bar stays mounted and nothing reloads on switch.
 *
 * The unread-count badge that used to sit on the 消息 tab is intentionally gone:
 * per-item unread dots live in the message list itself, so a second aggregate
 * counter on the tab bar was redundant noise.
 */
const { activeHomeTab, homeTabs, selectTab } = useHomeTabs();
</script>

<template>
  <nav class="tabbar">
    <v-btn
      v-for="tab in homeTabs"
      :key="tab.name"
      variant="text"
      :ripple="false"
      stacked
      class="tab"
      :class="{ 'is-active': activeHomeTab === tab.name }"
      @click="selectTab(tab.name)"
    >
      <v-icon
        :icon="activeHomeTab === tab.name ? tab.activeIcon : tab.icon"
        size="24"
      />
      <span class="label">{{ tab.label }}</span>
    </v-btn>
  </nav>
</template>

<style scoped>
.tabbar {
  flex: 0 0 auto;
  display: flex;
  align-items: stretch;
  justify-content: space-around;
  background: rgb(var(--v-theme-surface));
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  padding-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
}
.tab {
  flex: 1 1 0;
  min-width: 0;
  height: auto;
  min-height: 56px;
  border-radius: 0;
  color: rgba(var(--v-theme-on-surface), 0.62);
  text-transform: none;
  letter-spacing: 0;
}
.tab.is-active {
  color: rgb(var(--v-theme-primary));
}
.label {
  font-size: 11px;
  line-height: 1.1;
  font-weight: 500;
}
</style>
