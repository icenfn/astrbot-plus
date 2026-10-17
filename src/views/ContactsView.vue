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
 * 两个分组，分组标题使用 MDI 图标（不用 emoji）以匹配应用整体的图标语言：
 *
 *   • 智能体 — 来自配套插件的真实机器人列表；点击进入 **Agent 详情页**
 *             （`/agent/:id`，其中提供「发消息」入口）
 *   • 好友   — 本地联系人（占位数据）
 *
 * 已按要求移除「新的朋友」入口，并移除列表项的副标题 —— 联系人页只保留
 * 名称这一信息层级，副标题交给详情页。
 *
 * 分组标题吸顶在滚动区域顶部，紧贴应用栏下方。
 */
interface Person {
  name: string;
  seed: string;
}

const router = useRouter();
const chat = useChatStore();
const settings = useSettingsStore();
const { agents, contactsError } = storeToRefs(chat);
const { connected } = storeToRefs(settings);

// People are local-only; there is no server-side friends list yet.
const people: Person[] = [
  { name: "白露", seed: "bailu" },
  { name: "陈默", seed: "chenmo" },
  { name: "丁一", seed: "dingyi" },
  { name: "风信子", seed: "fengxinzi" },
  { name: "顾清", seed: "guqing" },
  { name: "海鸥", seed: "haiou" },
];

const agentsEmpty = computed(() => !agents.value.length);

/** Open the Agent detail page (merged info + 发消息). */
function openAgent(id: string) {
  void router.push(`/agent/${encodeURIComponent(id)}`);
}
</script>

<template>
  <div class="contacts">
    <div class="contacts-scroll">
      <v-list class="contacts-list">
        <!-- 智能体 — live list from the plugin -->
        <v-list-subheader class="group-head">
          <v-icon icon="mdi-robot-outline" size="16" class="group-icon" />
          <span>智能体</span>
          <span v-if="agents.length" class="group-count">{{ agents.length }}</span>
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
            <AstrbotAvatar :name="agent.name" :seed="agent.avatarSeed" :size="42" />
          </template>
          <template #append>
            <v-icon icon="mdi-chevron-right" size="18" class="chev" />
          </template>
        </v-list-item>

        <v-list-item
          v-if="agentsEmpty && !contactsError"
          :title="connected ? '暂无智能体' : '尚未连接插件'"
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
          v-for="person in people"
          :key="person.name"
          :title="person.name"
          link
        >
          <template #prepend>
            <AstrbotAvatar :name="person.name" :seed="person.seed" :size="42" />
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
  /* Vuetify's .v-list is `overflow: auto`, which would become the sticky scrollport
     and break the group-title pinning — let the pane own the scrollport. */
  overflow: visible;
}
.contacts-list :deep(.v-list-item) {
  border-radius: 12px;
  margin-bottom: 1px;
  /* 单行紧凑：不再预留副标题高度 */
  min-height: 54px;
}
/* Sticky group titles pinned under the app bar, with an MDI icon instead of emoji. */
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
.group-count {
  margin-left: auto;
  font-size: 11.5px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.45);
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
