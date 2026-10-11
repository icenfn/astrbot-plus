<script setup lang="ts">
import { computed } from "vue";
import type { ChatMessage } from "@/api/types";
import { renderMarkdown } from "@/utils/markdown";

const props = defineProps<{ message: ChatMessage; self?: boolean }>();

const isUser = computed(() => props.self ?? props.message.role === "user");
const isError = computed(() => !!props.message.error);
const isStreaming = computed(() => !!props.message.streaming);
const html = computed(() => renderMarkdown(props.message.text || ""));

/** Telegram-style HH:MM timestamp tucked into the bubble corner. */
const time = computed(() => {
  const raw = props.message.created_at;
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
});
</script>

<template>
  <div class="bubble-row" :class="isUser ? 'right' : 'left'">
    <div class="bubble" :class="{ user: isUser, error: isError }">
      <div class="md" v-html="html" />
      <span class="meta">
        <span v-if="isStreaming" class="caret" />
        <span v-if="time" class="time">{{ time }}</span>
        <v-icon
          v-if="isUser && !isStreaming && !isError"
          class="tick"
          icon="mdi-check-all"
          size="14"
        />
      </span>
    </div>
  </div>
</template>

<style scoped>
.bubble-row {
  display: flex;
  margin: 2.5px 0;
}
.bubble-row.left {
  justify-content: flex-start;
}
.bubble-row.right {
  justify-content: flex-end;
}
.bubble {
  position: relative;
  max-width: min(680px, 78%);
  padding: 7px 12px 6px;
  /* Telegram corners: one tight corner marks the "tail" side. */
  border-radius: 14px;
  border-bottom-left-radius: 5px;
  background: rgb(var(--v-theme-surface-light));
  color: rgb(var(--v-theme-on-surface));
  line-height: 1.5;
  font-size: 14.5px;
  word-break: break-word;
  overflow-wrap: anywhere;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
}
.bubble.user {
  background: rgb(var(--v-theme-own-bubble));
  color: rgb(var(--v-theme-on-own-bubble));
  border-radius: 14px;
  border-bottom-right-radius: 5px;
}
.bubble.error {
  background: rgba(229, 57, 53, 0.14);
  color: rgb(var(--v-theme-error));
  box-shadow: none;
}
/* Meta row: timestamp (+ read tick) floats to the bottom-right, Telegram style. */
.meta {
  float: right;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin: 8px 0 0 10px;
  line-height: 1;
  user-select: none;
}
.time {
  font-size: 11px;
  opacity: 0.62;
}
.tick {
  opacity: 0.62;
}
.caret {
  display: inline-block;
  width: 7px;
  height: 1.05em;
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
  background: rgba(10, 14, 20, 0.55);
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
.bubble.user .md :deep(a) {
  color: inherit;
  text-decoration: underline;
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
