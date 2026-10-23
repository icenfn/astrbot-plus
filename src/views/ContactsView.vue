<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import { useChatStore } from "@/stores/chat";
import { useSettingsStore } from "@/stores/settings";
import AstrbotAvatar from "@/components/AstrbotAvatar.vue";

/**
 * ContactsView — the 联系人 pane (embedded in HomeLayout).
 *
 * Two groups, both populated from the HTTP API once connected:
 *
 *   • 智能体 — `GET /api/agents`. Tap → `/agent/<agentId>`（信息页，再点「发消息」进会话）。
 *   • 好友   — `GET /api/users`. Tap → `/user/<userId>`（信息页，再点「发消息」进会话）。
 */
const router = useRouter();
const chat = useChatStore();
const settings = useSettingsStore();
const { agents, friends, contactsError, loadingContacts } = storeToRefs(chat);
const { connected } = storeToRefs(settings);

const agentsEmpty = computed(() => !agents.value.length);
const friendsEmpty = computed(() => !friends.value.length);

/** 点击智能体 → 先看 Agent 信息页（发消息按钮才进会话）。 */
function openAgent(id: string) {
  void router.push(`/agent/${encodeURIComponent(id)}`);
}

/** 点击好友 → 先看好友信息页（发消息按钮才进会话）。 */
function openFriend(userId: string) {
  void router.push(`/user/${encodeURIComponent(userId)}`);
}
</script>

<template>
  <div class="contacts">
    <div class="contacts-scroll">
      <v-list class="contacts-list">
        <!-- 智能体 -->
        <v-list-subheader class="group-head">
          <v-icon icon="mdi-robot-outline" size="16" class="group-icon" />
          <span>智能体</span>
        </v-list-subheader>

        <v-list-item
          v-if="contactsError"
          :title="contactsError"
          class="error-row"
        />

        <v-list-item
          v-for="agent in agents"
          :key="agent.id"
          :title="agent.name"
          link
          @click="openAgent(agent.id)"
        >
          <template #prepend>
            <AstrbotAvatar
              :name="agent.name"
              :src="agent.avatar"
              type="agent"
              :size="42"
            />
          </template>
          <template #append>
            <v-icon icon="mdi-chevron-right" size="18" class="chev" />
          </template>
        </v-list-item>

        <v-list-item
          v-if="agentsEmpty && !contactsError"
          :title="loadingContacts ? '正在加载…' : connected ? '暂无智能体' : '尚未连接服务器'"
          class="empty-row"
        >
          <template #prepend>
            <v-avatar size="42" rounded="lg" variant="tonal" color="primary">
              <v-icon icon="mdi-robot-outline" />
            </v-avatar>
          </template>
        </v-list-item>

        <!-- 好友 -->
        <v-list-subheader class="group-head">
          <v-icon icon="mdi-account-multiple-outline" size="16" class="group-icon" />
          <span>好友</span>
        </v-list-subheader>

        <v-list-item
          v-for="person in friends"
          :key="person.id"
          :title="person.username"
          link
          @click="openFriend(person.id)"
        >
          <template #prepend>
            <AstrbotAvatar
              :name="person.username"
              :src="person.avatar"
              type="user"
              :size="42"
            />
          </template>
          <template #append>
            <v-icon icon="mdi-chevron-right" size="18" class="chev" />
          </template>
        </v-list-item>

        <v-list-item
          v-if="friendsEmpty"
          :title="'暂无好友'"
          class="empty-row"
        >
          <template #prepend>
            <v-avatar size="42" rounded="lg" variant="tonal" color="primary">
              <v-icon icon="mdi-account-outline" />
            </v-avatar>
          </template>
        </v-list-item>
      </v-list>
    </div>
  </div>
</template>

<style scoped>
.contacts {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
}
.contacts-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.contacts-scroll::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
.contacts-list {
  background: transparent;
  padding: 2px 6px 12px;
  overflow: visible;
}
.contacts-list :deep(.v-list-item) {
  border-radius: 12px;
  margin-bottom: 1px;
  min-height: 54px;
}
.contacts-list :deep(.group-head) {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
  letter-spacing: 0.01em;
  padding-top: 8px;
  padding-bottom: 6px;
  min-height: 0;
  height: auto;
}
.group-icon {
  opacity: 0.9;
}
.contacts-list :deep(.v-list-item__prepend) {
  margin-inline-end: 14px;
}
.contacts-list :deep(.v-list-item-title) {
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 0.01em;
}
.chev {
  opacity: 0.32;
}
.error-row :deep(.v-list-item-title) {
  color: rgb(var(--v-theme-error));
  font-size: 13px;
}
.empty-row {
  opacity: 0.65;
}
</style>
