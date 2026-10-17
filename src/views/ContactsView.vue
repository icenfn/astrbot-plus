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
 * Three groups, each introduced by a sticky subheader that uses an MDI icon (no
 * emoji) so it matches the app's icon language:
 *
 *   • 新的朋友 — a static entry point
 *   • 智能体   — the REAL bot list fetched from the companion plugin
 *   • 好友     — local contacts
 *
 * The group titles stick to the top of the scroll area, directly under the app bar.
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

function openAgent(id: string) {
  void router.push(`/chat/${id}`);
}
</script>

<template>
  <div class="contacts">
    <div class="contacts-scroll">
      <v-list class="contacts-list">
        <v-list-item title="新的朋友" subtitle="添加新的联系人" link>
          <template #prepend>
            <v-avatar color="warning" size="44" rounded="lg" variant="tonal">
              <v-icon icon="mdi-account-plus" />
            </v-avatar>
          </template>
        </v-list-item>

        <!-- 智能体 — live list from the plugin -->
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
          :subtitle="connected ? 'AstrBot Agent' : '未连接'"
          link
          @click="openAgent(agent.id)"
        >
          <template #prepend>
            <AstrbotAvatar :name="agent.name" :seed="agent.avatarSeed" :size="44" />
          </template>
        </v-list-item>

        <v-list-item
          v-if="agentsEmpty && !contactsError"
          :title="connected ? '暂无智能体' : '尚未连接插件'"
          :subtitle="connected ? '请在 WebUI「创建机器人」页面创建' : '在「我的 → 设置」中重新配置'"
          class="empty-row"
        >
          <template #prepend>
            <v-avatar size="44" rounded="lg" variant="tonal" color="primary">
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
            <AstrbotAvatar :name="person.name" :seed="person.seed" :size="44" />
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
}
.group-icon {
  opacity: 0.9;
}
.error-row :deep(.v-list-item-title) {
  color: rgb(var(--v-theme-error));
  font-size: 13px;
}
.empty-row {
  opacity: 0.65;
}
</style>
