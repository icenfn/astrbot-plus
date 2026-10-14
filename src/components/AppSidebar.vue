<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "@/stores/settings";

const route = useRoute();
const settings = useSettingsStore();
const { isDark } = storeToRefs(settings);

// Desktop rail mirrors the mobile tabs. Settings moved to the「我的」page.
const items = [
  { icon: "mdi-forum-outline", active: "mdi-forum", to: "/", label: "消息", name: "chats" },
  {
    icon: "mdi-account-multiple-outline",
    active: "mdi-account-multiple",
    to: "/contacts",
    label: "联系人",
    name: "contacts",
  },
  {
    icon: "mdi-account-circle-outline",
    active: "mdi-account-circle",
    to: "/mine",
    label: "我的",
    name: "mine",
  },
];

const current = computed(() => route.name);
</script>

<template>
  <aside class="rail">
    <div class="rail-logo">
      <img src="/logo.svg" alt="AstrBot+" width="40" height="40" />
    </div>

    <nav class="rail-nav">
      <v-btn
        v-for="item in items"
        :key="item.name"
        :to="item.to"
        :icon="current === item.name ? item.active : item.icon"
        variant="text"
        :ripple="false"
        class="rail-btn"
        :class="{ 'is-active': current === item.name }"
        :title="item.label"
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
