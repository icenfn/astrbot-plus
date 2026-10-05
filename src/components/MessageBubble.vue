<script setup lang="ts">
import { computed } from "vue";
import type { ChatMessage } from "@/api/types";
import { renderMarkdown } from "@/utils/markdown";

const props = defineProps<{ message: ChatMessage; self?: boolean }>();

const isUser = computed(() => props.message.role === "user");
const isError = computed(() => !!props.message.error);

// Message bubbles render Markdown (headings, lists, code, links, ...).
const html = computed(() => renderMarkdown(props.message.text || ""));

function formatTime(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}
</script>

<template>
  <div class="bubble-row" :class="isUser ? 'out' : 'in'">
    <div class="bubble" :class="[isUser ? 'out' : 'in', { error: isError }]">
      <div v-if="message.text" class="text md" v-html="html"></div>
      <div v-else-if="message.streaming" class="text">正在生成…</div>
      <div class="foot">
        <span v-if="message.tokens" class="tokens">
          ↑{{ message.tokens.input ?? 0 }} ↓{{ message.tokens.output ?? 0 }}
        </span>
        <v-icon v-if="message.streaming" icon="mdi-dots-horizontal" size="16" class="typing" />
        <span v-else class="time">{{ formatTime(message.created_at) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bubble-row {
  display: flex;
  margin: 2px 0;
}
.bubble-row.out {
  justify-content: flex-end;
}
.bubble-row.in {
  justify-content: flex-start;
}
.bubble {
  max-width: min(620px, 78%);
  padding: 8px 12px 6px;
  border-radius: 14px;
  position: relative;
  word-break: break-word;
  overflow-wrap: anywhere;
  line-height: 1.45;
  font-size: 14.5px;
}
.bubble.in {
  background: rgb(var(--v-theme-surface));
  border-bottom-left-radius: 4px;
}
.bubble.out {
  background: rgb(var(--v-theme-primary));
  color: #fff;
  border-bottom-right-radius: 4px;
}
.bubble.error {
  background: rgba(229, 57, 53, 0.16);
  color: #ff8a80;
}
.text {
  word-break: break-word;
}
/* --- Markdown-rendered content (v-html, hence :deep) --------------------- */
.md :deep(> :first-child) {
  margin-top: 0;
}
.md :deep(> :last-child) {
  margin-bottom: 0;
}
.md :deep(p) {
  margin: 0 0 8px;
}
.md :deep(h1),
.md :deep(h2),
.md :deep(h3),
.md :deep(h4),
.md :deep(h5),
.md :deep(h6) {
  margin: 10px 0 6px;
  line-height: 1.3;
  font-weight: 600;
}
.md :deep(h1) {
  font-size: 1.35em;
}
.md :deep(h2) {
  font-size: 1.25em;
}
.md :deep(h3) {
  font-size: 1.15em;
}
.md :deep(ul),
.md :deep(ol) {
  margin: 4px 0 8px;
  padding-left: 1.4em;
}
.md :deep(li) {
  margin: 2px 0;
}
.md :deep(a) {
  color: inherit;
  text-decoration: underline;
  word-break: break-all;
}
.md :deep(code) {
  font-family: "SFMono-Regular", "JetBrains Mono", Consolas, "Liberation Mono", monospace;
  font-size: 0.88em;
  background: rgba(128, 150, 170, 0.22);
  border-radius: 4px;
  padding: 1px 4px;
}
.md :deep(.md-pre) {
  margin: 6px 0;
  padding: 10px 12px;
  border-radius: 10px;
  overflow-x: auto;
  background: rgba(0, 0, 0, 0.28);
}
.bubble.out .md :deep(.md-pre) {
  background: rgba(0, 0, 0, 0.22);
}
.md :deep(.md-pre code) {
  background: transparent;
  padding: 0;
  font-size: 0.86em;
  line-height: 1.5;
}
.md :deep(blockquote) {
  margin: 6px 0;
  padding: 2px 10px;
  border-left: 3px solid rgba(128, 150, 170, 0.6);
  opacity: 0.92;
}
.md :deep(hr) {
  border: none;
  border-top: 1px solid rgba(128, 150, 170, 0.35);
  margin: 10px 0;
}
.md :deep(.md-img) {
  max-width: 100%;
  border-radius: 8px;
  display: block;
}
.foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 2px;
  font-size: 10.5px;
  opacity: 0.72;
}
.bubble.out .foot {
  color: rgba(255, 255, 255, 0.85);
}
.tokens {
  font-variant-numeric: tabular-nums;
}
.typing {
  animation: blink 1s steps(2, start) infinite;
}
@keyframes blink {
  50% {
    opacity: 0.25;
  }
}
</style>
