<script setup lang="ts">
/**
 * ChatList — the Agent (bot) directory.
 *
 * One row per AstrBot bot created in the WebUI「创建机器人」page. The row shows
 * the bot's nickname as the display name, the latest message as the subtitle,
 * and an unread badge. The list reflects the plugin's real-time `message:new`
 * broadcast, so it always shows the newest content without any manual refresh —
 * the previous 手动刷新按钮 has been removed.
 */
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import { useChatStore } from "@/stores/chat";
import { useSettingsStore } from "@/stores/settings";
import { usePlatform } from "@/composables/usePlatform";
import AstrbotAvatar from "./AstrbotAvatar.vue";

const chat = useChatStore();
const settings = useSettingsStore();
const router = useRouter();
const { filteredAgents, activeKey, loadingContacts, contactsError } =
  storeToRefs(chat);
const { connected } = storeToRefs(settings);
const { isMobile } = usePlatform();

// Opening a conversation navigates to its route so the back button / Android
// hardware back always has somewhere to return to.
function open(id: string) {
  void router.push(`/chat/${id}`);
}

const emptyText = computed(() => {
  if (!connected.value) return "尚未连接到插件";
  return "暂无 Agent，请在 WebUI「创建机器人」页面创建";
});
</script>

<template>
  <aside class="chat-list">
    <header class="head">
      <div class="head-title">
        <span>消息</span>
      </div>
    </header>

    <div class="search-wrap">
      <v-text-field
        v-model="chat.search"
        placeholder="搜索 Agent"
        prepend-inner-icon="mdi-magnify"
        density="compact"
        variant="solo-filled"
        hide-details
        clearable
        flat
      />
    </div>

    <div class="rows chat-scroll">
      <v-alert
        v-if="contactsError"
        type="error"
        variant="tonal"
        density="compact"
        class="ma-2"
        :text="contactsError"
      />

      <div v-if="loadingContacts && !filteredAgents.length" class="loading">
        <v-progress-circular indeterminate size="26" />
      </div>

      <div v-else-if="!filteredAgents.length" class="empty">
        <v-icon icon="mdi-robot-outline" size="32" class="mb-2" />
        <p>{{ emptyText }}</p>
      </div>

      <button
        v-for="agent in filteredAgents"
        :key="agent.id"
        class="row"
        :class="{ active: agent.id === activeKey }"
        type="button"
        @click="open(agent.id)"
      >
        <AstrbotAvatar :name="agent.name" :seed="agent.avatarSeed" :size="48" />
        <div class="row-main">
          <div class="row-top">
            <span class="row-name">{{ agent.name }}</span>
            <span v-if="chat.unreadOf(agent.id) > 0" class="row-badge">
              {{ chat.unreadOf(agent.id) > 99 ? "99+" : chat.unreadOf(agent.id) }}
            </span>
          </div>
          <div class="row-sub">
            {{ agent.lastMessage || "开始对话" }}
          </div>
        </div>
      </button>
    </div>
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
.head {
  flex: 0 0 auto;
  padding: 12px 16px 8px;
}
.head-title {
  display: flex;
  align-items: center;
  font-size: 17px;
  font-weight: 700;
}
.search-wrap {
  flex: 0 0 auto;
  padding: 0 12px 8px;
}
.rows {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 0 6px 8px;
}
.loading,
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
  padding: 48px 24px;
  text-align: center;
}
.row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 10px;
  border: none;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  color: inherit;
}
.row:hover {
  background: rgba(var(--v-theme-primary), 0.08);
}
.row.active {
  background: rgba(var(--v-theme-primary), 0.16);
}
.row-main {
  flex: 1 1 auto;
  min-width: 0;
}
.row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.row-name {
  font-weight: 600;
  font-size: 14.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-badge {
  flex: 0 0 auto;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 11.5px;
  font-weight: 700;
  display: grid;
  place-items: center;
}
.row-sub {
  font-size: 12.5px;
  opacity: 0.62;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}
</style>
