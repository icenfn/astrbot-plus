<script setup lang="ts">
import { computed } from "vue";
import type { ChatMessage, PeerType } from "@/api/types";
import { renderMarkdown } from "@/utils/markdown";
import AstrbotAvatar from "./AstrbotAvatar.vue";

/**
 * MessageBubble — 一条聊天消息。
 *
 * 气泡两侧显示头像（Telegram 式）：对方消息头像在左，我方消息头像在右。
 * 头像地址由会话元数据 / 当前登录用户提供，组件本身不生成头像。
 */
const props = defineProps<{
  message: ChatMessage;
  self?: boolean;
  /** 该消息所属一方的头像（我方 = 当前登录用户，对方 = 会话对端）。 */
  avatar?: string;
  /** 该消息所属一方的显示名（用作 alt / title）。 */
  name?: string;
  /** 对方若是智能体，默认头像用 agent 版。 */
  peerType?: PeerType;
}>();

const isUser = computed(() => props.self ?? props.message.role === "user");
const isError = computed(() => !!props.message.error);

/** 我方默认头像固定为用户版；对方按 peerType 区分。 */
const avatarType = computed<"user" | "agent">(() =>
  isUser.value ? "user" : props.peerType === "agent" ? "agent" : "user",
);

/**
 * Render the reply body as markdown. The reply text is shown as-is: the client no
 * longer parses「思考内容」/「工具调用信息」out of it (the plugin aggregates a turn
 * into a single assistant message, so there is nothing extra to split off).
 */
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
    <AstrbotAvatar
      v-if="!isUser"
      class="row-avatar"
      :src="avatar"
      :name="name"
      :type="avatarType"
      :size="30"
    />
    <div class="bubble" :class="{ user: isUser, error: isError }">
      <div v-if="html" class="md" v-html="html" />
      <span class="meta">
        <span v-if="time" class="time">{{ time }}</span>
        <v-icon v-if="isUser && !isError" class="tick" icon="mdi-check-all" size="14" />
      </span>
    </div>
    <AstrbotAvatar
      v-if="isUser"
      class="row-avatar"
      :src="avatar"
      :name="name"
      type="user"
      :size="30"
    />
  </div>
</template>

<style scoped>
.bubble-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin: 2.5px 0;
}
.bubble-row.left {
  justify-content: flex-start;
}
.bubble-row.right {
  justify-content: flex-end;
}
.row-avatar {
  margin-bottom: 2px;
}
.bubble {
  position: relative;
  max-width: min(680px, 78%);
  padding: 7px 12px 6px;
  /* Telegram corners: one tight corner marks the "tail" side. */
  border-radius: 14px;
  border-bottom-left-radius: 5px;
  /* Incoming (对方) bubbles are white in both themes, per product spec. */
  background: #ffffff;
  color: #16202b;
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
