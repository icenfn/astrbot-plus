<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useSettingsStore } from "@/stores/settings";
import { usePlatform } from "@/composables/usePlatform";
import ChatList from "@/components/ChatList.vue";
import ChatWindow from "@/components/ChatWindow.vue";

/**
 * ChatsView — the 消息 tab home (route `/`).
 *
 * Mobile shows only the Agent list; opening a conversation navigates to
 * `/chat/:id`, rendered full-screen by `MessageLayout`. Desktop keeps the two-pane
 * workspace: the list plus an (initially empty) conversation pane.
 *
 * Until the plugin connection is up the pane shows a centred ring progress
 * indicator; the previous 「欢迎使用默认页面」 placeholder and its inline
 * connection dialog were removed — first-run configuration now lives in the
 * standalone 向导 page.
 */
const settings = useSettingsStore();
const { connected } = storeToRefs(settings);
const { isMobile } = usePlatform();
</script>

<template>
  <div class="chats-view">
    <template v-if="connected">
      <!-- Mobile: list only. -->
      <ChatList v-if="isMobile" class="pane-full" />

      <!-- Desktop: two panes. -->
      <template v-else>
        <ChatList class="list" />
        <ChatWindow class="window-pane" />
      </template>
    </template>

    <div v-else class="loading">
      <v-progress-circular indeterminate color="primary" size="48" width="4" />
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
.loading {
  flex: 1;
  display: grid;
  place-items: center;
}
</style>
