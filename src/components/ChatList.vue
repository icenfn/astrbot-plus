<script setup lang="ts">
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import { useChatStore } from "@/stores/chat";
import { useSettingsStore } from "@/stores/settings";
import AstrbotAvatar from "./AstrbotAvatar.vue";

/**
 * ChatList — the Agent (bot) directory / 消息 list.
 *
 * One row per AstrBot bot pulled from the companion plugin. The list reflects the
 * plugin's real-time `message:new` broadcast, so it shows the newest content with
 * no manual refresh. Unread conversations show a small RED dot.
 *
 * Long-pressing a row (touch) opens a context menu with 置顶消息 / 设为未读 / 删除消息.
 * The menu entries are placeholders for now — they are deliberately not wired to any
 * backend action yet.
 */
const chat = useChatStore();
const settings = useSettingsStore();
const router = useRouter();
const { agents, activeKey, contactsError } = storeToRefs(chat);
const { connected } = storeToRefs(settings);

function open(id: string) {
  void router.push(`/chat/${id}`);
}

const emptyText = computed(() => {
  if (!connected.value) return "尚未连接到插件";
  return "暂无 Agent，请在 WebUI「创建机器人」页面创建";
});

// ---- long-press context menu (placeholder actions) ----
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
  }, 480);
}
function cancelPress() {
  window.clearTimeout(pressTimer);
}

function noop() {
  // Placeholder: pinned / unread / delete are not implemented yet.
  menuOpen.value = false;
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

      <div v-if="!agents.length" class="empty">
        <v-icon icon="mdi-forum-outline" size="34" class="mb-2" />
        <p>{{ emptyText }}</p>
      </div>

      <v-list v-else class="rows-list" nav>
        <v-list-item
          v-for="agent in agents"
          :key="agent.id"
          :active="agent.id === activeKey"
          active-color="primary"
          rounded="lg"
          class="row"
          @click="open(agent.id)"
          @pointerdown="startPress($event, agent.id)"
          @pointerup="cancelPress"
          @pointerleave="cancelPress"
          @pointercancel="cancelPress"
          @contextmenu.prevent
        >
          <template #prepend>
            <AstrbotAvatar :name="agent.name" :seed="agent.avatarSeed" :size="48" />
          </template>
          <v-list-item-title class="row-title">{{ agent.name }}</v-list-item-title>
          <v-list-item-subtitle class="row-sub">
            {{ agent.lastMessage || "开始对话" }}
          </v-list-item-subtitle>
          <template #append>
            <span v-if="chat.unreadOf(agent.id) > 0" class="unread-dot" />
          </template>
        </v-list-item>
      </v-list>
    </div>

    <!-- Long-press context menu (placeholder actions) -->
    <v-menu
      v-model="menuOpen"
      :target="[menuAnchor.x, menuAnchor.y]"
      location="bottom start"
      offset="4"
      :close-on-content-click="true"
    >
      <v-list density="compact" min-width="168">
        <v-list-item prepend-icon="mdi-pin-outline" title="置顶消息" @click="noop" />
        <v-list-item prepend-icon="mdi-email-mark-as-unread" title="设为未读" @click="noop" />
        <v-list-item
          prepend-icon="mdi-delete-outline"
          title="删除消息"
          base-color="error"
          @click="noop"
        />
      </v-list>
    </v-menu>
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
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.rows::-webkit-scrollbar {
  display: none;
  width: 0;
}
.rows-list {
  background: transparent;
  padding: 0;
}
.row {
  margin-bottom: 2px;
}
.row-title {
  font-size: 15px;
  font-weight: 600;
}
.row-sub {
  font-size: 13px;
  opacity: 0.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
/* Unread indicator: a small red dot on the right. */
.unread-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: rgb(var(--v-theme-error, 244 67 54));
  flex: 0 0 auto;
}
</style>
