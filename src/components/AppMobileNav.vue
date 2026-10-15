<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { storeToRefs } from "pinia";
import { useChatStore } from "@/stores/chat";

const route = useRoute();
const chat = useChatStore();
const { totalUnread } = storeToRefs(chat);

// Three primary tabs: 消息 / 联系人 / 我的. Settings is no longer a tab — it
// lives behind the「我的」page.
const tabs = [
  { to: "/", name: "chats", label: "消息", icon: "mdi-forum-outline", active: "mdi-forum" },
  {
    to: "/contacts",
    name: "contacts",
    label: "联系人",
    icon: "mdi-account-multiple-outline",
    active: "mdi-account-multiple",
  },
  {
    to: "/mine",
    name: "mine",
    label: "我的",
    icon: "mdi-account-circle-outline",
    active: "mdi-account-circle",
  },
];

const current = computed(() => route.name);
const unreadLabel = computed(() => (totalUnread.value > 99 ? "99+" : String(totalUnread.value)));
</script>

<template>
  <nav class="tabbar">
    <v-btn
      v-for="tab in tabs"
      :key="tab.name"
      :to="tab.to"
      variant="text"
      :ripple="false"
      stacked
      class="tab"
      :class="{ 'is-active': current === tab.name }"
    >
      <v-badge
        v-if="tab.name === 'chats'"
        :content="unreadLabel"
        :model-value="totalUnread > 0"
        color="error"
        offset-x="6"
        offset-y="4"
      >
        <v-icon :icon="current === tab.name ? tab.active : tab.icon" size="24" />
      </v-badge>
      <v-icon v-else :icon="current === tab.name ? tab.active : tab.icon" size="24" />
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
