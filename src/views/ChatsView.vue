<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "@/stores/settings";
import { usePlatform } from "@/composables/usePlatform";
import ChatList from "@/components/ChatList.vue";
import ChatWindow from "@/components/ChatWindow.vue";
import ConnectionDialog from "@/components/ConnectionDialog.vue";

/**
 * ChatsView — the 消息 tab home (route `/`).
 *
 * Mobile shows only the Agent list; opening a conversation navigates to
 * `/chat/:id`, which is rendered by `MessageLayout` full-screen. Desktop keeps
 * the two-pane workspace: the list plus an (initially empty) conversation pane
 * that fills in once an Agent is selected.
 */
const settings = useSettingsStore();
const { connected } = storeToRefs(settings);
const { isMobile } = usePlatform();

const needsSetup = computed(() => !settings.hasCredentials || !connected.value);
</script>

<template>
  <div class="chats-view">
    <template v-if="!needsSetup">
      <!-- Mobile: list only. -->
      <ChatList v-if="isMobile" class="pane-full" />

      <!-- Desktop: two panes. -->
      <template v-else>
        <ChatList class="list" />
        <ChatWindow class="window-pane" />
      </template>
    </template>

    <div v-else class="welcome">
      <div class="welcome-inner">
        <img src="/logo.svg" alt="AstrBot+" width="96" height="96" />
        <h1 class="text-h5 mt-4">欢迎使用 AstrBot+</h1>
        <p class="text-medium-emphasis mt-2 text-center">
          连接到 AstrBot+ 配套插件，即可与 WebUI「创建机器人」里创建的 Agent 对话。
        </p>
        <ConnectionDialog class="mt-4" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.chats-view {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  height: 100%;
  /* Match the 消息 list surface so all three home panes share one colour. */
  background: rgb(var(--v-theme-surface));
}
.list {
  width: 340px;
  flex: 0 0 340px;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.window-pane {
  flex: 1 1 auto;
  min-width: 0;
}
.pane-full {
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
}
.welcome {
  flex: 1;
  display: grid;
  place-items: center;
}
.welcome-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 440px;
}
</style>
