<script setup lang="ts">
import { computed } from "vue";
import type { ChatMessage } from "@/api/types";
import { renderMarkdown } from "@/utils/markdown";

const props = defineProps<{ message: ChatMessage; self?: boolean }>();

const isUser = computed(() => props.self ?? props.message.role === "user");
const isError = computed(() => !!props.message.error);
const isStreaming = computed(() => !!props.message.streaming);
const html = computed(() => renderMarkdown(props.message.text || ""));
</script>

<template>
  <div class="bubble-row" :class="isUser ? 'right' : 'left'">
    <div class="bubble" :class="{ user: isUser, error: isError }">
      <div class="md" v-html="html" />
      <span v-if="isStreaming" class="caret" />
    </div>
  </div>
</template>

<style scoped>
.bubble-row {
  display: flex;
  margin: 3px 0;
}
.bubble-row.left {
  justify-content: flex-start;
}
.bubble-row.right {
  justify-content: flex-end;
}
.bubble {
  max-width: min(680px, 78%);
  padding: 9px 13px;
  border-radius: 16px;
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface));
  line-height: 1.55;
  font-size: 14.5px;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.bubble.user {
  background: rgb(var(--v-theme-primary));
  color: #fff;
  border-bottom-right-radius: 6px;
}
.bubble.error {
  background: rgba(229, 57, 53, 0.16);
  color: rgb(var(--v-theme-error));
}
.caret {
  display: inline-block;
  width: 7px;
  height: 1.05em;
  margin-left: 2px;
  vertical-align: text-bottom;
  background: currentColor;
  opacity: 0.7;
  animation: blink 1s steps(2, start) infinite;
}
@keyframes blink {
  to {
    visibility: hidden;
  }
}
.md :deep(p) {
  margin: 0 0 6px;
}
.md :deep(p:last-child) {
  margin-bottom: 0;
}
.md :deep(pre) {
  background: #0d1117;
  border-radius: 10px;
  padding: 10px 12px;
  overflow-x: auto;
  margin: 6px 0;
}
.md :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.9em;
}
.md :deep(:not(pre) > code) {
  background: rgba(127, 140, 150, 0.22);
  padding: 1px 5px;
  border-radius: 5px;
}
.md :deep(a) {
  color: rgb(var(--v-theme-secondary));
}
.md :deep(table) {
  border-collapse: collapse;
  margin: 6px 0;
}
.md :deep(th),
.md :deep(td) {
  border: 1px solid rgba(127, 140, 150, 0.3);
  padding: 4px 8px;
}
.md :deep(img) {
  max-width: 100%;
  border-radius: 8px;
}
</style>
