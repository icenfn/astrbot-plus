<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import { useChatStore } from "@/stores/chat";
import { useSettingsStore } from "@/stores/settings";
import AstrbotAvatar from "./AstrbotAvatar.vue";

/**
 * ChatList — the Agent (bot) directory.
 *
 * One row per AstrBot bot created in the WebUI「创建机器人」page. The in-page
 * 「消息」title and the search box were removed: the page title now lives in the
 * app-wide application bar, and filtering by keyword is gone. The list reflects
 * the plugin's real-time `message:new` broadcast, so it always shows the newest
 * content without any manual refresh.
 */
const chat = useChatStore();
const settings = useSettingsStore();
const router = useRouter();
const { agents, activeKey, loadingContacts, contactsError } = storeToRefs(chat);
const { connected } = storeToRefs(settings);

// Opening a conversation navigates to its route so the back button / Android
// hardware back always has somewhere to return to.
function open(id: string) {
  void router.push(`/chat/${id}`);
}

const emptyText = computed(() => {
  if (!connected.value) return "尚未连接到插件";
  return "暂无 Agent，请在 WebUI「创建机器人」页面创建";
});

function badge(id: string): string {
  const n = chat.unreadOf(id);
  return n > 99 ? "99+" : String(n);
}
</script>

<template>
  <aside class="chat-list">
    <div class="rows chat-scroll">
      <v-alert
        v-if="contactsError"
        type="error"
        variant="tonal"
        density="compact"
        class="ma-2"
        :text="contactsError"
      />

      <div v-if="loadingContacts && !agents.length" class="loading">
        <v-progress-circular indeterminate size="26" />
      </div>

      <div v-else-if="!agents.length" class="empty">
        <v-icon icon="mdi-robot-outline" size="32" class="mb-2" />
        <p>{{ emptyText }}</p>
      </div>

      <v-list v-else class="rows-list" nav>
        <v-list-item
          v-for="agent in agents"
          :key="agent.id"
          :title="agent.name"
          :subtitle="agent.lastMessage || '开始对话'"
          :active="agent.id === activeKey"
          active-color="primary"
          rounded="lg"
          @click="open(agent.id)"
        >
          <template #prepend>
            <AstrbotAvatar :name="agent.name" :seed="agent.avatarSeed" :size="48" />
          </template>
          <template #append>
            <v-chip
              v-if="chat.unreadOf(agent.id) > 0"
              size="x-small"
              color="primary"
              variant="flat"
              class="unread-chip"
            >
              {{ badge(agent.id) }}
            </v-chip>
          </template>
        </v-list-item>
      </v-list>
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
.rows {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 6px;
}
.rows-list {
  background: transparent;
  padding: 0;
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
.unread-chip {
  font-weight: 700;
}
</style>
