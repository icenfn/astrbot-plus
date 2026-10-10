<script setup lang="ts">
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { useChatStore } from "@/stores/chat";
import type { ChatTarget } from "@/api/types";
import ContactItem from "./ContactItem.vue";
import NewDialogDialog from "./NewDialogDialog.vue";
import GroupDialog from "./GroupDialog.vue";

const chat = useChatStore();
const { activeKey, filteredContacts, loadingContacts, contactsError, filter, search, contacts } =
  storeToRefs(chat);

const filters = [
  { label: "全部", value: "all" as const, icon: "mdi-format-list-bulleted" },
  { label: "对话", value: "dialog" as const, icon: "mdi-chat-outline" },
  { label: "AI 好友", value: "friend" as const, icon: "mdi-account" },
  { label: "群聊", value: "group" as const, icon: "mdi-account-group" },
];

function isActive(t: ChatTarget): boolean {
  return `${t.kind}:${t.id}` === activeKey.value;
}

// --- Add menu (dialog / group) ----------------------------------------------
const addMenuOpen = ref(false);
const dialogDialog = ref(false);
const groupDialog = ref(false);

function openNewDialog() {
  addMenuOpen.value = false;
  dialogDialog.value = true;
}
function openGroupDialog() {
  addMenuOpen.value = false;
  groupDialog.value = true;
}

// --- Action sheet (long-press menu) ------------------------------------------
const menuTarget = ref<ChatTarget | null>(null);
const menuOpen = ref(false);
const confirmOpen = ref(false);
const deleting = ref(false);
const deleteError = ref("");

const menuUnread = computed(() =>
  menuTarget.value ? chat.unreadOf(`${menuTarget.value.kind}:${menuTarget.value.id}`) : 0,
);

const deletable = computed(() => menuTarget.value?.kind === "dialog" || menuTarget.value?.kind === "group");

const deleteLabel = computed(() =>
  menuTarget.value?.kind === "dialog" ? "删除对话" : "解散群聊",
);

function openMenu(t: ChatTarget) {
  menuTarget.value = t;
  menuOpen.value = true;
}

function closeMenu() {
  menuOpen.value = false;
}

function onMarkRead() {
  if (menuTarget.value) chat.markRead(`${menuTarget.value.kind}:${menuTarget.value.id}`);
  closeMenu();
}

function onMarkUnread() {
  if (menuTarget.value) chat.markUnread(`${menuTarget.value.kind}:${menuTarget.value.id}`);
  closeMenu();
}

function askDelete() {
  closeMenu();
  deleteError.value = "";
  confirmOpen.value = true;
}

async function confirmDelete() {
  const t = menuTarget.value;
  if (!t) return;
  deleting.value = true;
  deleteError.value = "";
  try {
    if (t.kind === "dialog") await chat.removeDialog(t.id);
    else if (t.kind === "group") await chat.removeGroup(t.id);
    confirmOpen.value = false;
    menuTarget.value = null;
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : String(e);
  } finally {
    deleting.value = false;
  }
}

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
        <v-menu v-model="addMenuOpen" location="bottom end">
          <template #activator="{ props }">
            <v-btn icon="mdi-plus" size="small" variant="text" color="primary" v-bind="props" />
          </template>
          <v-list density="compact">
            <v-list-item
              prepend-icon="mdi-chat-plus-outline"
              title="新建对话"
              @click="openNewDialog"
            />
            <v-list-item
              prepend-icon="mdi-account-multiple-plus"
              title="新建群聊"
              @click="openGroupDialog"
            />
          </v-list>
        </v-menu>
      </div>
      <v-text-field
        v-model="search"
        placeholder="搜索对话、好友或群聊"
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
        type="warning"
        variant="tonal"
        density="compact"
        class="ma-3"
        :text="`无法从插件同步（本地数据仍可用）：${contactsError}`"
      />

      <div v-if="loadingContacts && !contacts.length" class="center">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <div v-else-if="!filteredContacts.length" class="empty">
        <v-icon icon="mdi-chat-plus-outline" size="40" class="mb-2" />
        <p class="text-medium-emphasis">还没有对话</p>
        <p class="text-caption text-medium-emphasis text-center">
          点击右上角「+」新建对话，与 AstrBot 的 Webchat 沟通；也可以和 WebUI 里创建的机器人聊。
        </p>
      </div>

      <div v-else class="items">
        <ContactItem
          v-for="c in filteredContacts"
          :key="`${c.kind}:${c.id}`"
          :target="c"
          :active="isActive(c)"
          :unread="chat.unreadOf(`${c.kind}:${c.id}`)"
          @select="chat.openTarget($event)"
          @menu="openMenu($event)"
        />
      </div>
    </div>

    <!-- Long-press / right-click action sheet -->
    <v-dialog v-model="menuOpen" max-width="360">
      <v-card>
        <v-card-title class="menu-title">{{ menuTarget?.displayName }}</v-card-title>
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
            v-if="deletable"
            prepend-icon="mdi-delete-outline"
            :title="deleteLabel"
            base-color="error"
            @click="askDelete"
          />
        </v-list>
      </v-card>
    </v-dialog>

    <!-- Delete confirmation -->
    <v-dialog v-model="confirmOpen" max-width="360">
      <v-card>
        <v-card-title>{{ deleteLabel }}</v-card-title>
        <v-card-text>
          <template v-if="menuTarget?.kind === 'dialog'">
            确定要删除「{{ menuTarget?.displayName }}」吗？该对话的历史记录会一并删除。
          </template>
          <template v-else>
            确定要解散「{{ menuTarget?.displayName }}」吗？群聊记录会被删除，群内 AI 好友本身不受影响。
          </template>
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

    <NewDialogDialog v-model="dialogDialog" />
    <GroupDialog v-model="groupDialog" />
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
.menu-title {
  font-size: 15px;
  font-weight: 600;
  padding-bottom: 8px;
}
</style>
