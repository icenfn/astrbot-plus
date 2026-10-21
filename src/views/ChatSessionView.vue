<script setup lang="ts">
import ChatWindow from "@/components/ChatWindow.vue";

/**
 * ChatSessionView — a single open conversation (route `/chat/:id`).
 *
 * Rendered inside `MessageLayout`, which supplies the surrounding chrome (the
 * Agent list on desktop; nothing on mobile, where `ChatWindow` draws its own
 * header with the back button).
 */
</script>

<template>
  <ChatWindow class="pane-full" />
</template>

<style scoped>
.pane-full {
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
}
</style>
