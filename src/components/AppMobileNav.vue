<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "@/stores/settings";
import { useChatStore } from "@/stores/chat";

const route = useRoute();
const settings = useSettingsStore();
const chat = useChatStore();
const { connected } = storeToRefs(settings);
const { totalUnread } = storeToRefs(chat);

const tabs = [
  { to: "/", name: "chats", label: "聊天", icon: "mdi-forum-outline", active: "mdi-forum" },
  { to: "/settings", name: "settings", label: "设置", icon: "mdi-cog-outline", active: "mdi-cog" },
];

const current = computed(() => route.name);
const unreadLabel = computed(() => (totalUnread.value > 99 ? "99+" : String(totalUnread.value)));
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
      <!-- Chats tab: unread badge -->
      <v-badge
        v-if="tab.name === 'chats'"
        :content="unreadLabel"
        :model-value="totalUnread > 0"
        color="error"
        offset-x="4"
        offset-y="2"
      >
        <v-icon :icon="current === tab.name ? tab.active : tab.icon" size="24" />
      </v-badge>
      <!-- Settings tab: connection dot -->
      <v-badge
        v-else-if="tab.name === 'settings'"
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
