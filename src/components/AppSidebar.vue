<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "@/stores/settings";

const route = useRoute();
const settings = useSettingsStore();
const { isDark, connected } = storeToRefs(settings);

const items = [
  { icon: "mdi-forum-outline", active: "mdi-forum", to: "/", label: "聊天", name: "chats" },
];

const current = computed(() => route.name);
</script>

<template>
  <aside class="rail">
    <div class="rail-logo">
      <img src="/logo.svg" alt="AstrBot+" width="40" height="40" />
    </div>

    <nav class="rail-nav">
      <router-link
        v-for="item in items"
        :key="item.name"
        :to="item.to"
        class="rail-btn"
        :class="{ 'is-active': current === item.name }"
        :title="item.label"
      >
        <v-icon :icon="current === item.name ? item.active : item.icon" size="24" />
      </router-link>
    </nav>

    <div class="rail-foot">
      <button class="rail-btn" :title="isDark ? '浅色主题' : '深色主题'" @click="settings.cycleTheme()">
        <v-icon :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'" size="22" />
      </button>
      <router-link
        to="/settings"
        class="rail-btn"
        :class="{ 'is-active': current === 'settings' }"
        title="设置"
      >
        <v-icon icon="mdi-cog-outline" size="22" />
        <span class="status-dot" :class="connected ? 'ok' : 'off'"></span>
      </router-link>
    </div>
  </aside>
</template>

<style scoped>
.rail {
  width: 68px;
  flex: 0 0 68px;
  background: rgb(var(--v-theme-surface));
  border-right: 1px solid rgba(128, 150, 170, 0.14);
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
  position: relative;
  width: 46px;
  height: 46px;
  border-radius: 14px;
  border: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  display: grid;
  place-items: center;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s ease, color 0.15s ease;
}
.rail-btn:hover {
  background: rgba(var(--v-theme-primary), 0.13);
}
.rail-btn.is-active {
  background: rgba(var(--v-theme-primary), 0.2);
  color: rgb(var(--v-theme-primary));
}
.status-dot {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 2px solid rgb(var(--v-theme-surface));
}
.status-dot.ok {
  background: #4caf50;
}
.status-dot.off {
  background: #9e9e9e;
}
</style>
