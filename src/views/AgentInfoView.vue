<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useChatStore } from "@/stores/chat";
import AstrbotAvatar from "@/components/AstrbotAvatar.vue";

/**
 * AgentInfoView — the「Agent 详情」page (route `/agent/:id`).
 *
 * 合并后的 Agent 信息页：既可以从**联系人页**点击智能体进入，也可以从**聊天页**
 * 右上角的信息按钮进入，因此它同时承担「联系人详情」与「Agent 配置」两个角色，
 * 并在顶部提供 **发消息** 主操作，直达该 Agent 的会话。
 *
 * 只保留与用户决策相关的信息：显示名、Bot ID、名称。启用状态、平台适配器、
 * 服务端信息（插件名 / 版本 / 端口）已按要求移除 —— 它们对终端用户没有意义，
 * 且会让页面变成「调试面板」。
 */
const route = useRoute();
const router = useRouter();
const chat = useChatStore();
const { agents } = storeToRefs(chat);

const botId = computed(() =>
  typeof route.params.id === "string" ? route.params.id : "",
);

// Prefer the live store row (name / avatar); fall back to the raw id when the
// Agent is not in the current list (e.g. a deep link).
const agent = computed(() => agents.value.find((a) => a.id === botId.value) ?? null);
const displayName = computed(() => agent.value?.name || botId.value);
const displaySeed = computed(() => agent.value?.avatarSeed || botId.value);

/** 发消息：进入该 Agent 的会话页。 */
function startChat(): void {
  if (!botId.value) return;
  void router.push(`/chat/${encodeURIComponent(botId.value)}`);
}
</script>

<template>
  <div class="agent-info">
    <div class="agent-info-inner">
      <div class="hero">
        <AstrbotAvatar :name="displayName" :seed="displaySeed" :size="88" />
        <h1 class="hero-name">{{ displayName }}</h1>
        <div class="hero-sub">AstrBot Agent</div>
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
        <div class="card-title">配置</div>
        <v-list class="card-list" lines="two">
          <v-list-item prepend-icon="mdi-identifier" title="Bot ID">
            <template #subtitle>
              <span class="mono">{{ botId || "—" }}</span>
            </template>
          </v-list-item>
          <v-list-item
            prepend-icon="mdi-account-outline"
            title="名称"
            :subtitle="displayName"
          />
        </v-list>
      </v-card>
    </div>
  </div>
</template>

<style scoped>
.agent-info {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 20px 16px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.agent-info::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
.agent-info-inner {
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
}
.hero-sub {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
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
