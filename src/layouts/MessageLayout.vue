<script setup lang="ts">
import { usePlatform } from "@/composables/usePlatform";
import AppTopBar from "@/components/AppTopBar.vue";
import AppSidebar from "@/components/AppSidebar.vue";
import ChatList from "@/components/ChatList.vue";

/**
 * MessageLayout — the 消息页面 (message page) frame.
 *
 * Wraps a single open conversation (`/chat/:id`). Desktop keeps the familiar
 * three-column workspace (application bar + rail + Agent list + conversation);
 * mobile drops all chrome and shows the conversation full-screen, where
 * `ChatWindow` renders its own header with the back button.
 */
const { isMobile } = usePlatform();
</script>

<template>
  <div class="message-layout">
    <template v-if="!isMobile">
      <AppTopBar />
      <div class="message-body">
        <AppSidebar />
        <ChatList class="message-list" />
        <div class="message-view">
          <router-view />
        </div>
      </div>
    </template>

    <!-- Mobile: full-screen conversation pane. -->
    <div v-else class="message-view">
      <router-view />
    </div>
  </div>
</template>

<style scoped>
.message-layout {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.message-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}
.message-list {
  width: 340px;
  flex: 0 0 340px;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.message-view {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
</style>
