<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import type { Contact } from "@/api/types";
import AstrbotAvatar from "./AstrbotAvatar.vue";

const props = defineProps<{ contact: Contact; active?: boolean; unread?: number }>();
const emit = defineEmits<{
  (e: "select", c: Contact): void;
  (e: "menu", c: Contact): void;
}>();

const isGroup = computed(() => props.contact.messageType === "GroupMessage");

const unreadLabel = computed(() => {
  const n = props.unread ?? 0;
  if (n <= 0) return "";
  return n > 99 ? "99+" : String(n);
});

/** Subtitle shows the latest message content (Telegram-style), not the platform. */
const subtitle = computed(() => {
  const last = (props.contact.lastMessage || "").replace(/\s+/g, " ").trim();
  if (last) return last;
  return isGroup.value ? "群聊" : "单聊";
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

// --- Long-press (touch) / right-click (desktop) → action menu -----------------
let timer: number | undefined;
let longPressed = false;

function startPress() {
  longPressed = false;
  clearPress();
  timer = window.setTimeout(() => {
    longPressed = true;
    emit("menu", props.contact);
  }, 480);
}
function clearPress() {
  if (timer !== undefined) {
    window.clearTimeout(timer);
    timer = undefined;
  }
}

function onSelect() {
  // Suppress the click that follows a long-press.
  if (longPressed) {
    longPressed = false;
    return;
  }
  emit("select", props.contact);
}

function onContext(e: MouseEvent) {
  e.preventDefault();
  emit("menu", props.contact);
}

onBeforeUnmount(clearPress);
</script>

<template>
  <button
    class="contact"
    :class="{ active }"
    @click="onSelect"
    @contextmenu="onContext"
    @touchstart.passive="startPress"
    @touchend="clearPress"
    @touchcancel="clearPress"
    @touchmove="clearPress"
    @mousedown="startPress"
    @mouseup="clearPress"
    @mouseleave="clearPress"
  >
    <AstrbotAvatar :name="contact.displayName" :seed="contact.avatarSeed" :group="isGroup" />
    <div class="meta">
      <div class="row">
        <span class="name">{{ contact.displayName }}</span>
        <span class="time">{{ relTime(contact.updatedAt) }}</span>
      </div>
      <div class="row">
        <span class="preview">{{ subtitle }}</span>
        <span v-if="unreadLabel" class="badge">{{ unreadLabel }}</span>
        <v-chip v-else-if="isGroup" size="x-small" color="primary" variant="tonal" label>群</v-chip>
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
  -webkit-touch-callout: none;
  user-select: none;
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
/* Telegram-style unread badge */
.badge {
  flex: 0 0 auto;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: #e53935;
  color: #fff;
  font-size: 11.5px;
  font-weight: 700;
  line-height: 20px;
  text-align: center;
}
</style>
