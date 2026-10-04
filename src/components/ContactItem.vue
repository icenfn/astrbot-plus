<script setup lang="ts">
import { computed } from "vue";
import type { Contact } from "@/api/types";
import AstrbotAvatar from "./AstrbotAvatar.vue";

const props = defineProps<{ contact: Contact; active?: boolean }>();
const emit = defineEmits<{ (e: "select", c: Contact): void }>();

const isGroup = computed(() => props.contact.messageType === "GroupMessage");

const platformLabel = computed(() => {
  const p = props.contact.platform;
  const map: Record<string, string> = {
    webchat: "WebChat",
    aiocqhttp: "QQ",
    qq_official: "QQ",
    telegram: "Telegram",
    discord: "Discord",
    wechat: "微信",
    weixin: "微信",
    slack: "Slack",
    lark: "飞书",
  };
  return map[p] || p || "未知";
});

function relTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `${hh}:${mm}`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
</script>

<template>
  <button class="contact" :class="{ active }" @click="emit('select', contact)">
    <AstrbotAvatar :name="contact.displayName" :seed="contact.avatarSeed" :group="isGroup" />
    <div class="meta">
      <div class="row">
        <span class="name">{{ contact.displayName }}</span>
        <span class="time">{{ relTime(contact.updatedAt) }}</span>
      </div>
      <div class="row">
        <span class="preview">{{ isGroup ? "群聊" : "单聊" }} · {{ platformLabel }}</span>
        <v-chip v-if="isGroup" size="x-small" color="primary" variant="tonal" label>群</v-chip>
      </div>
    </div>
  </button>
</template>

<style scoped>
.contact {
  width: 100%;
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  border-radius: 12px;
  transition: background 0.12s ease;
}
.contact:hover {
  background: rgba(47, 134, 189, 0.1);
}
.contact.active {
  background: rgba(47, 134, 189, 0.2);
}
.meta {
  flex: 1 1 auto;
  min-width: 0;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.name {
  font-weight: 600;
  font-size: 14.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.time {
  font-size: 11.5px;
  opacity: 0.6;
  flex: 0 0 auto;
}
.preview {
  font-size: 12.5px;
  opacity: 0.66;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
