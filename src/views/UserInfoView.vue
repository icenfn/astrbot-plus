<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useChatStore, userPeerKey } from "@/stores/chat";
import AstrbotAvatar from "@/components/AstrbotAvatar.vue";

/**
 * UserInfoView — the「好友信息」page (route `/user/:id`).
 *
 * 从联系人页点击好友进入，先展示好友资料（头像 / 用户名 / ap_id / 邮箱），
 * 只有点击「发消息」才进入与该好友的私聊会话 —— 与 Agent 信息页保持一致的
 * 「先看资料、再发消息」交互。
 */
const route = useRoute();
const router = useRouter();
const chat = useChatStore();
const { friends } = storeToRefs(chat);

const userId = computed(() =>
  typeof route.params.id === "string" ? route.params.id : "",
);

const friend = computed(() => friends.value.find((f) => f.id === userId.value) ?? null);
const displayName = computed(() => friend.value?.username || userId.value);
const avatar = computed(() => friend.value?.avatar || "");
const apId = computed(() => friend.value?.ap_id || "");
const email = computed(() => friend.value?.email || "");

/** 发消息：进入与该好友的私聊会话。 */
function startChat(): void {
  if (!userId.value) return;
  void router.push(`/chat/${encodeURIComponent(userPeerKey(userId.value))}`);
}
</script>

<template>
  <div class="user-info">
    <div class="user-info-inner">
      <div class="hero">
        <AstrbotAvatar :name="displayName" :src="avatar" type="user" :size="88" />
        <h1 class="hero-name">{{ displayName }}</h1>
        <div v-if="apId" class="hero-sub mono">{{ apId }}</div>
        <v-btn
          class="talk-btn"
          color="primary"
          variant="flat"
          rounded="lg"
          prepend-icon="mdi-message-text-outline"
          @click="startChat"
        >
          发消息
        </v-btn>
      </div>

      <v-card class="card" variant="flat" rounded="lg">
        <div class="card-title">资料</div>
        <v-list class="card-list" lines="two">
          <v-list-item prepend-icon="mdi-account-outline" title="用户名">
            <template #subtitle>{{ displayName }}</template>
          </v-list-item>
          <v-list-item prepend-icon="mdi-key-variant" title="ap_id">
            <template #subtitle>
              <span class="mono">{{ apId || "—" }}</span>
            </template>
          </v-list-item>
          <v-list-item v-if="email" prepend-icon="mdi-email-outline" title="邮箱">
            <template #subtitle>{{ email }}</template>
          </v-list-item>
        </v-list>
      </v-card>
    </div>
  </div>
</template>

<style scoped>
.user-info {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 20px 16px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.user-info::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
.user-info-inner {
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 0 4px;
}
.hero-name {
  font-size: 20px;
  font-weight: 700;
  margin: 4px 0 0;
  text-align: center;
  word-break: break-word;
}
.hero-sub {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  word-break: break-all;
}
.talk-btn {
  margin-top: 12px;
  width: 100%;
  max-width: 260px;
  font-weight: 600;
}
.card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  background: rgb(var(--v-theme-surface));
  padding: 4px 0 8px;
}
.card-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.6);
  padding: 12px 16px 4px;
}
.card-list {
  background: transparent;
}
.mono {
  font-family: ui-monospace, "SFMono-Regular", "Menlo", monospace;
  word-break: break-all;
}
</style>
