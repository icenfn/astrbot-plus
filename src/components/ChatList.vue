<script setup lang="ts">
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import { useChatStore } from "@/stores/chat";
import { useSettingsStore } from "@/stores/settings";
import AstrbotAvatar from "./AstrbotAvatar.vue";

/**
 * ChatList — the 消息 (conversation) list.
 *
 * 微信式的「会话列表」：每一行代表一个**会话**，显示 Agent 名称 + 最近一条消息，
 * 按「置顶优先 → 最近活跃」排序。它刻意不是单纯的「机器人列表」——机器人目录只
 * 负责播种会话，之后列表反映的是真实的聊天活动（`message:new` 实时广播）。
 *
 * 交互：
 *   • 点击          → 打开会话
 *   • 长按          → 弹出菜单（置顶 / 取消置顶、删除消息）
 *   • 未读          → 右上角数字角标，1~99，超过显示 99+
 *   • 删除          → 二次确认后同时清除本地缓存与服务端历史
 */
const chat = useChatStore();
const settings = useSettingsStore();
const router = useRouter();
const { activeKey, contactsError, conversationRows, loadingContacts } = storeToRefs(chat);
const { connected } = storeToRefs(settings);

function open(id: string) {
  void router.push(`/chat/${id}`);
}

/** Unread badge text: 1~99, then 99+. */
function badge(n: number): string {
  if (n <= 0) return "";
  return n > 99 ? "99+" : String(n);
}

const emptyText = computed(() => {
  if (!connected.value) return "尚未连接到插件";
  if (loadingContacts.value) return "正在加载会话…";
  return "暂无会话，请在 WebUI「创建机器人」页面创建";
});

/** Compact time label for the row's right edge (今天 时:分 / 昨天 / 日期). */
function shortTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `${hh}:${mm}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return "昨天";
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}/${d.getDate()}`;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

// ---- long-press context menu ----
const menuOpen = ref(false);
const menuAgent = ref<string>("");
const menuAnchor = ref<{ x: number; y: number }>({ x: 0, y: 0 });
let pressTimer: number | undefined;

function startPress(e: PointerEvent, id: string) {
  menuAgent.value = id;
  const { clientX, clientY } = e;
  pressTimer = window.setTimeout(() => {
    menuAnchor.value = { x: clientX, y: clientY };
    menuOpen.value = true;
  }, 460);
}
function cancelPress() {
  window.clearTimeout(pressTimer);
}

const menuPinned = computed(
  () => menuAgent.value !== "" && chat.isPinned(menuAgent.value),
);

function togglePin() {
  if (menuAgent.value) chat.togglePinned(menuAgent.value);
  menuOpen.value = false;
}

// ---- delete with a second confirmation ----
const confirmOpen = ref(false);
const confirmAgent = ref<string>("");
const deleting = ref(false);

const confirmName = computed(() => {
  const row = conversationRows.value.find((a) => a.id === confirmAgent.value);
  return row?.name || confirmAgent.value;
});

function askDelete() {
  confirmAgent.value = menuAgent.value;
  menuOpen.value = false;
  if (confirmAgent.value) confirmOpen.value = true;
}

async function doDelete() {
  if (!confirmAgent.value || deleting.value) return;
  deleting.value = true;
  try {
    await chat.deleteConversation(confirmAgent.value);
    confirmOpen.value = false;
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <aside class="chat-list">
    <div class="rows">
      <v-alert
        v-if="contactsError"
        type="error"
        variant="tonal"
        density="compact"
        class="ma-2"
        :text="contactsError"
      />

      <div v-if="!conversationRows.length" class="empty">
        <v-icon icon="mdi-forum-outline" size="34" class="mb-2" />
        <p>{{ emptyText }}</p>
      </div>

      <v-list v-else class="rows-list" nav>
        <v-list-item
          v-for="row in conversationRows"
          :key="row.id"
          :active="row.id === activeKey"
          active-color="primary"
          rounded="lg"
          class="row"
          @click="open(row.id)"
          @pointerdown="startPress($event, row.id)"
          @pointerup="cancelPress"
          @pointerleave="cancelPress"
          @pointercancel="cancelPress"
          @contextmenu.prevent
        >
          <template #prepend>
            <div class="avatar-wrap">
              <AstrbotAvatar :name="row.name" :seed="row.avatarSeed" :size="48" />
              <span v-if="chat.unreadOf(row.id) > 0" class="badge">
                {{ badge(chat.unreadOf(row.id)) }}
              </span>
            </div>
          </template>

          <v-list-item-title class="row-title">{{ row.name }}</v-list-item-title>
          <v-list-item-subtitle class="row-sub">
            {{ row.lastMessage || "开始对话" }}
          </v-list-item-subtitle>

          <template #append>
            <div class="row-end">
              <span v-if="chat.isPinned(row.id)" class="pin-flag">
                <v-icon icon="mdi-pin" size="13" />
              </span>
              <span class="row-time">{{ shortTime(row.updatedAt) }}</span>
            </div>
          </template>
        </v-list-item>
      </v-list>
    </div>

    <!-- Long-press context menu -->
    <v-menu
      v-model="menuOpen"
      :target="[menuAnchor.x, menuAnchor.y]"
      location="bottom start"
      offset="4"
      :close-on-content-click="true"
    >
      <v-list density="compact" min-width="168">
        <v-list-item
          :prepend-icon="menuPinned ? 'mdi-pin-off-outline' : 'mdi-pin-outline'"
          :title="menuPinned ? '取消置顶' : '置顶会话'"
          @click="togglePin"
        />
        <v-list-item
          prepend-icon="mdi-delete-outline"
          title="删除会话"
          base-color="error"
          @click="askDelete"
        />
      </v-list>
    </v-menu>

    <!-- Second confirmation for delete -->
    <v-dialog v-model="confirmOpen" max-width="340">
      <v-card rounded="lg">
        <v-card-title class="text-body-1 font-weight-bold pt-4">
          删除会话
        </v-card-title>
        <v-card-text class="text-body-2">
          将删除与「{{ confirmName }}」的全部聊天记录（本地和服务端），此操作不可恢复。
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="deleting" @click="confirmOpen = false">
            取消
          </v-btn>
          <v-btn
            color="error"
            variant="flat"
            rounded="lg"
            :loading="deleting"
            @click="doDelete"
          >
            删除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </aside>
</template>

<style scoped>
.chat-list {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: rgb(var(--v-theme-surface));
}
.rows {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 8px;
  /* WeChat-style: the list itself scrolls without a visible scrollbar. */
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.rows::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
.rows-list {
  background: transparent;
  padding: 0;
}
.row {
  margin-bottom: 2px;
}
.avatar-wrap {
  position: relative;
  flex: 0 0 auto;
}
/* Unread count badge, pinned to the avatar's top-right like WeChat. */
.badge {
  position: absolute;
  top: -4px;
  right: -6px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 9px;
  background: rgb(var(--v-theme-error, 244 67 54));
  color: #fff;
  font-size: 11px;
  line-height: 17px;
  font-weight: 600;
  text-align: center;
  box-shadow: 0 0 0 2px rgb(var(--v-theme-surface));
  box-sizing: border-box;
}
.row-title {
  font-size: 15px;
  font-weight: 600;
}
.row-sub {
  font-size: 13px;
  opacity: 0.58;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-end {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex: 0 0 auto;
}
.pin-flag {
  opacity: 0.45;
  display: inline-flex;
}
.row-time {
  font-size: 11.5px;
  opacity: 0.45;
  white-space: nowrap;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0.55;
  padding: 56px 24px;
  text-align: center;
}
</style>
