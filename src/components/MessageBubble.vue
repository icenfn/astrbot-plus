<script setup lang="ts">
import { computed } from "vue";
import type { ChatMessage } from "@/api/types";

const props = defineProps<{ message: ChatMessage; self?: boolean }>();

const isUser = computed(() => props.message.role === "user");
const isError = computed(() => !!props.message.error);

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
      <div class="text">{{ message.text || (message.streaming ? "正在生成…" : "") }}</div>
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
  white-space: pre-wrap;
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
  white-space: pre-wrap;
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
