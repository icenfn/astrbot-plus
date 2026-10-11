<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { storeToRefs } from "pinia";
import { useChatStore } from "@/stores/chat";
import type { AgentRow } from "@/api/types";
import AstrbotAvatar from "./AstrbotAvatar.vue";

const chat = useChatStore();
const { activeKey, filteredAgents, loadingContacts, contactsError, search, agents } = storeToRefs(chat);

const filters = [{ label: "Agent", value: "agent" as const, icon: "mdi-robot" }];

function isActive(a: AgentRow): boolean {
  return a.id === activeKey.value;
}

function unreadLabel(a: AgentRow): string {
  const n = chat.unreadOf(a.id);
  if (n <= 0) return "";
  return n > 99 ? "99+" : String(n);
}

function subtitle(a: AgentRow): string {
  return (a.lastMessage || "").replace(/\s+/g, " ").trim() || "开始和这个 Agent 对话吧";
}

function relTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// --- Long-press (touch) / right-click (desktop) → read-state menu -------------
const menuTarget = ref<AgentRow | null>(null);
const menuOpen = ref(false);
const menuUnread = computed(() => (menuTarget.value ? chat.unreadOf(menuTarget.value.id) : 0));

function openMenu(a: AgentRow) {
  menuTarget.value = a;
  menuOpen.value = true;
}

function onMarkRead() {
  if (menuTarget.value) chat.markRead(menuTarget.value.id);
  menuOpen.value = false;
}

function onMarkUnread() {
  if (menuTarget.value) chat.markUnread(menuTarget.value.id);
  menuOpen.value = false;
}

let pressTimer: number | undefined;
let longPressed = false;
function startPress(a: AgentRow) {
  longPressed = false;
  clearPress();
  pressTimer = window.setTimeout(() => {
    longPressed = true;
    openMenu(a);
  }, 480);
}
function clearPress() {
  if (pressTimer !== undefined) {
    window.clearTimeout(pressTimer);
    pressTimer = undefined;
  }
}
function onSelect(a: AgentRow) {
  if (longPressed) {
    longPressed = false;
    return;
  }
  chat.openAgent(a.id);
}
function onContext(e: MouseEvent, a: AgentRow) {
  e.preventDefault();
  openMenu(a);
}
onBeforeUnmount(clearPress);

async function refresh() {
  await chat.loadContacts();
}
</script>

<template>
  <section class="list-pane">
    <header class="head">
      <div class="head-top">
        <h2 class="title">AstrBot+</h2>
        <v-spacer />
        <v-btn
          icon="mdi-refresh"
          size="small"
          variant="text"
          :loading="loadingContacts"
          title="刷新"
          @click="refresh"
        />
      </div>
      <v-text-field
        v-model="search"
        placeholder="搜索 Agent"
        prepend-inner-icon="mdi-magnify"
        density="compact"
        variant="solo-filled"
        flat
        hide-details
        clearable
        class="search"
      />
      <div class="chips">
        <v-chip
          v-for="f in filters"
          :key="f.value"
          :prepend-icon="f.icon"
          size="small"
          variant="flat"
          color="primary"
          @click="chat.filter = f.value"
        >
          {{ f.label }}
        </v-chip>
      </div>
    </header>

    <div class="scroll">
      <v-alert
        v-if="contactsError"
        type="warning"
        variant="tonal"
        density="compact"
        class="ma-3"
        :text="`无法从插件同步（本地数据仍可用）：${contactsError}`"
      />

      <div v-if="loadingContacts && !agents.length" class="center">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <div v-else-if="!filteredAgents.length" class="empty">
        <v-icon icon="mdi-robot-outline" size="40" class="mb-2" />
        <p class="text-medium-emphasis">还没有 Agent</p>
        <p class="text-caption text-medium-emphasis text-center">
          请先在 AstrBot WebUI 的「创建机器人」页面创建机器人。
        </p>
      </div>

      <div v-else class="items">
        <button
          v-for="a in filteredAgents"
          :key="a.id"
          class="contact"
          :class="{ active: isActive(a) }"
          @click="onSelect(a)"
          @contextmenu="onContext($event, a)"
          @touchstart.passive="startPress(a)"
          @touchend="clearPress"
          @touchcancel="clearPress"
          @touchmove="clearPress"
          @mousedown="startPress(a)"
          @mouseup="clearPress"
          @mouseleave="clearPress"
        >
          <AstrbotAvatar :name="a.name" :seed="a.avatarSeed" />
          <div class="meta">
            <div class="row">
              <span class="name">{{ a.name }}</span>
              <span class="time">{{ relTime(a.updatedAt) }}</span>
            </div>
            <div class="row">
              <span class="preview">{{ subtitle(a) }}</span>
              <span v-if="unreadLabel(a)" class="badge">{{ unreadLabel(a) }}</span>
            </div>
          </div>
        </button>
      </div>
    </div>

    <!-- Long-press / right-click action sheet -->
    <v-dialog v-model="menuOpen" max-width="360">
      <v-card>
        <v-card-title class="menu-title">{{ menuTarget?.name }}</v-card-title>
        <v-divider />
        <v-list density="compact">
          <v-list-item
            v-if="menuUnread"
            prepend-icon="mdi-email-open-outline"
            title="标记为已读"
            @click="onMarkRead"
          />
          <v-list-item
            v-else
            prepend-icon="mdi-email-outline"
            title="标记为未读"
            @click="onMarkUnread"
          />
        </v-list>
      </v-card>
    </v-dialog>
  </section>
</template>

<style scoped>
.list-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgb(var(--v-theme-surface));
}
.head {
  padding: 14px 14px 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.head-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.2px;
}
.search {
  margin-top: 2px;
}
.chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 4px 6px 10px;
}
.items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.center {
  display: grid;
  place-items: center;
  padding: 40px 0;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 20px;
}
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
  background: rgba(var(--v-theme-primary), 0.09);
}
.contact.active {
  background: rgba(var(--v-theme-primary), 0.18);
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
.badge {
  flex: 0 0 auto;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgb(var(--v-theme-primary));
  color: #fff;
  font-size: 11.5px;
  font-weight: 700;
  line-height: 20px;
  text-align: center;
}
.menu-title {
  font-size: 15px;
  font-weight: 600;
  padding-bottom: 8px;
}
</style>
