<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useSettingsStore } from "@/stores/settings";
import { useHomeTabs } from "@/composables/useHomeTabs";

/**
 * Desktop side rail — mirrors the mobile tabs. It drives the same embedded
 * pane switch (`useHomeTabs`) instead of routing, so desktop and mobile share
 * one navigation model.
 */
const settings = useSettingsStore();
const { isDark } = storeToRefs(settings);
const { activeHomeTab, homeTabs, selectTab } = useHomeTabs();
</script>

<template>
  <aside class="rail">
    <div class="rail-logo">
      <img src="/logo.svg" alt="AstrBot+" width="40" height="40" />
    </div>

    <nav class="rail-nav">
      <v-btn
        v-for="item in homeTabs"
        :key="item.name"
        :icon="activeHomeTab === item.name ? item.activeIcon : item.icon"
        variant="text"
        :ripple="false"
        class="rail-btn"
        :class="{ 'is-active': activeHomeTab === item.name }"
        :title="item.label"
        @click="selectTab(item.name)"
      />
    </nav>

    <div class="rail-foot">
      <v-btn
        :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
        variant="text"
        :ripple="false"
        class="rail-btn"
        :title="isDark ? '浅色主题' : '深色主题'"
        @click="settings.cycleTheme()"
      />
    </div>
  </aside>
</template>

<style scoped>
.rail {
  width: 68px;
  flex: 0 0 68px;
  background: rgb(var(--v-theme-surface));
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  gap: 8px;
}
.rail-logo {
  margin-bottom: 10px;
  display: grid;
  place-items: center;
}
.rail-nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1 1 auto;
}
.rail-foot {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rail-btn {
  color: rgb(var(--v-theme-on-surface));
}
.rail-btn.is-active {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.16);
}
</style>
