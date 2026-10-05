<script setup lang="ts">
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { useChatStore } from "@/stores/chat";
import type { Contact } from "@/api/types";
import ContactItem from "./ContactItem.vue";

const chat = useChatStore();
const { activeUmo, filteredContacts, loadingContacts, contactsError, filter, search, contacts, wsStatus } =
  storeToRefs(chat);

const filters = [
  { label: "全部", value: "all" as const, icon: "mdi-format-list-bulleted" },
  { label: "单聊", value: "FriendMessage" as const, icon: "mdi-account" },
  { label: "群聊", value: "GroupMessage" as const, icon: "mdi-account-group" },
];

const wsLabel = computed(() => {
  switch (wsStatus.value) {
    case "open":
      return "实时连接";
    case "connecting":
      return "连接中…";
    case "closed":
      return "已断开";
    default:
      return "未连接";
  }
});
const wsColor = computed(() =>
  wsStatus.value === "open" ? "success" : wsStatus.value === "connecting" ? "warning" : "grey",
);

// --- Action sheet (long-press menu) ------------------------------------------
const menuContact = ref<Contact | null>(null);
const menuOpen = ref(false);
const confirmOpen = ref(false);
const deleting = ref(false);
const deleteError = ref("");

const menuUnread = computed(() =>
  menuContact.value ? chat.unreadOf(menuContact.value.umo) : 0,
);

function openMenu(contact: Contact) {
  menuContact.value = contact;
  menuOpen.value = true;
}

function closeMenu() {
  menuOpen.value = false;
}

function onMarkRead() {
  if (menuContact.value) chat.markRead(menuContact.value.umo);
  closeMenu();
}

function onMarkUnread() {
  if (menuContact.value) chat.markUnread(menuContact.value.umo);
  closeMenu();
}

function askDelete() {
  closeMenu();
  deleteError.value = "";
  confirmOpen.value = true;
}

async function confirmDelete() {
  if (!menuContact.value) return;
  deleting.value = true;
  deleteError.value = "";
  try {
    await chat.deleteContact(menuContact.value);
    confirmOpen.value = false;
    menuContact.value = null;
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : String(e);
  } finally {
    deleting.value = false;
  }
}

async function refresh() {
  chat.connectWs();
  await chat.loadContacts({ detectNew: true });
}

// --- New chat ----------------------------------------------------------------
const newOpen = ref(false);
const newType = ref<"FriendMessage" | "GroupMessage">("FriendMessage");
const newName = ref("");
const newId = ref("");

function openNew() {
  newType.value = "FriendMessage";
  newName.value = "";
  newId.value = "";
  newOpen.value = true;
}

function confirmNew() {
  if (!newName.value.trim()) return;
  chat.createChat({ name: newName.value.trim(), type: newType.value, id: newId.value.trim() });
  newOpen.value = false;
}
</script>

<template>
  <section class="list-pane">
    <header class="head">
      <div class="head-top">
        <h2 class="title">AstrBot+</h2>
        <div class="head-actions">
          <v-chip size="x-small" :color="wsColor" variant="tonal" label class="ws-chip">
            {{ wsLabel }}
          </v-chip>
          <v-btn
            icon="mdi-message-plus-outline"
            size="small"
            variant="text"
            color="primary"
            title="发起新会话"
            @click="openNew"
          />
          <v-btn
            icon="mdi-refresh"
            size="small"
            variant="text"
            :loading="loadingContacts"
            @click="refresh"
          />
        </div>
      </div>
      <v-text-field
        v-model="search"
        placeholder="搜索会话"
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
          :variant="filter === f.value ? 'flat' : 'tonal'"
          :color="filter === f.value ? 'primary' : undefined"
          @click="chat.filter = f.value"
        >
          {{ f.label }}
        </v-chip>
      </div>
    </header>

    <div class="scroll">
      <v-alert
        v-if="contactsError"
        type="error"
        variant="tonal"
        density="compact"
        class="ma-3"
        :text="contactsError"
      />

      <div v-if="loadingContacts && !contacts.length" class="center">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <div v-else-if="!filteredContacts.length" class="empty">
        <v-icon icon="mdi-message-text-outline" size="40" class="mb-2" />
        <p class="text-medium-emphasis">暂无会话</p>
        <p class="text-caption text-medium-emphasis text-center">
          点击右上角「新建」可发起单聊或群聊；在 AstrBot 中产生的 AstrBot+ 会话也会显示在这里。
        </p>
      </div>

      <div v-else class="items">
        <ContactItem
          v-for="c in filteredContacts"
          :key="c.umo"
          :contact="c"
          :active="c.umo === activeUmo"
          :unread="chat.unreadOf(c.umo)"
          @select="chat.openContact($event)"
          @menu="openMenu($event)"
        />
      </div>
    </div>

    <!-- New chat dialog -->
    <v-dialog v-model="newOpen" max-width="420">
      <v-card>
        <v-card-title>发起新会话</v-card-title>
        <v-card-text class="d-flex flex-column ga-4 pt-2">
          <v-btn-toggle v-model="newType" mandatory color="primary" variant="tonal" divided>
            <v-btn value="FriendMessage" prepend-icon="mdi-account">单聊</v-btn>
            <v-btn value="GroupMessage" prepend-icon="mdi-account-group">群聊</v-btn>
          </v-btn-toggle>
          <v-text-field
            v-model="newName"
            :label="newType === 'FriendMessage' ? '对方名称' : '群名称'"
            placeholder="例如：小明 / 开发群"
            prepend-inner-icon="mdi-card-account-details-outline"
            hide-details
          />
          <v-text-field
            v-model="newId"
            label="会话标识（可选）"
            :placeholder="newType === 'FriendMessage' ? '对方用户 ID，留空则用名称' : '群 ID，留空则用名称'"
            prepend-inner-icon="mdi-identifier"
            hint="用于生成 UMO：astrbot-plus:{单聊|群聊}:标识。留空则使用上方名称。"
            persistent-hint
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="newOpen = false">取消</v-btn>
          <v-btn color="primary" variant="flat" :disabled="!newName.trim()" @click="confirmNew">
            创建并打开
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Long-press / right-click action sheet -->
    <v-dialog v-model="menuOpen" max-width="360">
      <v-card>
        <v-card-title class="menu-title">{{ menuContact?.displayName }}</v-card-title>
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
          <v-list-item
            prepend-icon="mdi-delete-outline"
            title="删除会话"
            base-color="error"
            @click="askDelete"
          />
        </v-list>
      </v-card>
    </v-dialog>

    <!-- Delete confirmation -->
    <v-dialog v-model="confirmOpen" max-width="360">
      <v-card>
        <v-card-title>删除会话</v-card-title>
        <v-card-text>
          确定要删除「{{ menuContact?.displayName }}」吗？该操作会同时删除服务器上的会话记录，且不可恢复。
          <v-alert
            v-if="deleteError"
            type="error"
            variant="tonal"
            density="compact"
            class="mt-3"
            :text="deleteError"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmOpen = false">取消</v-btn>
          <v-btn color="error" variant="flat" :loading="deleting" @click="confirmDelete">
            删除
          </v-btn>
        </v-card-actions>
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
.head-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
.ws-chip {
  margin-right: 4px;
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
.menu-title {
  font-size: 15px;
  font-weight: 600;
  padding-bottom: 8px;
}
</style>
