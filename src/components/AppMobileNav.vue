<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "@/stores/settings";

const route = useRoute();
const settings = useSettingsStore();
const { connected } = storeToRefs(settings);

const tabs = [
  { to: "/", name: "chats", label: "聊天", icon: "mdi-forum-outline", active: "mdi-forum" },
  {
    to: "/contacts",
    name: "contacts",
    label: "会话",
    icon: "mdi-account-multiple-outline",
    active: "mdi-account-multiple",
  },
  { to: "/settings", name: "settings", label: "设置", icon: "mdi-cog-outline", active: "mdi-cog" },
];

const current = computed(() => route.name);
</script>

<template>
  <nav class="tabbar">
    <router-link
      v-for="tab in tabs"
      :key="tab.name"
      :to="tab.to"
      class="tab"
      :class="{ 'is-active': current === tab.name }"
    >
      <v-badge
        v-if="tab.name === 'settings'"
        dot
        :color="connected ? 'success' : 'grey'"
        offset-x="2"
        offset-y="2"
      >
        <v-icon :icon="current === tab.name ? tab.active : tab.icon" size="24" />
      </v-badge>
      <v-icon v-else :icon="current === tab.name ? tab.active : tab.icon" size="24" />
      <span class="label">{{ tab.label }}</span>
    </router-link>
  </nav>
</template>

<style scoped>
.tabbar {
  flex: 0 0 auto;
  display: flex;
  align-items: stretch;
  justify-content: space-around;
  background: rgb(var(--v-theme-surface));
  border-top: 1px solid rgba(128, 150, 170, 0.18);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.tab {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 8px 4px 6px;
  text-decoration: none;
  color: rgba(var(--v-theme-on-surface), 0.62);
  transition: color 0.15s ease;
}
.tab.is-active {
  color: rgb(var(--v-theme-primary));
}
.label {
  font-size: 11px;
  line-height: 1;
}
</style>
