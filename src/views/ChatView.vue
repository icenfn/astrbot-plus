<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";
import { useSettingsStore } from "@/stores/settings";
import { useChatStore } from "@/stores/chat";
import { usePlatform } from "@/composables/usePlatform";
import ChatList from "@/components/ChatList.vue";
import ChatWindow from "@/components/ChatWindow.vue";
import ConnectionDialog from "@/components/ConnectionDialog.vue";

const route = useRoute();
const router = useRouter();
const settings = useSettingsStore();
const chat = useChatStore();
const { connected } = storeToRefs(settings);
const { activeKey } = storeToRefs(chat);
const { isMobile } = usePlatform();

// Mobile shows a single pane: the list, or the open Agent.
const showListOnMobile = computed(() => !activeKey.value);
const needsSetup = computed(() => !settings.hasCredentials || !connected.value);

// The open conversation is driven by the route (`/chat/:id`). Keeping the
// route as the single source of truth is what finally fixes "can't get back to
// the list (首页) from the message page": every way of leaving a chat — the
// header back button, the Android hardware back button — just moves the route
// back to `/`, which clears the active Agent.
function routeId(): string {
  return typeof route.params.id === "string" ? route.params.id : "";
}

watch(
  routeId,
  (id) => {
    if (id === chat.activeKey) return;
    if (id) chat.openAgent(id);
    else chat.closeActive();
  },
  { immediate: true },
);

// Keep the route in sync when the active Agent is changed from elsewhere (e.g.
// tapping a system notification). Guarded on both sides so the two watchers
// settle without ping-ponging.
watch(activeKey, (key) => {
  const id = routeId();
  if (key === id) return;
  if (key) void router.replace(`/chat/${key}`);
  else if (id) void router.replace("/");
});

onMounted(async () => {
  if (settings.hasCredentials && !connected.value) {
    const ok = await settings.connect();
    // loadContacts() also binds the real-time `message:new` feed so the list
    // updates live (unread badge / subtitle / notifications).
    if (ok) await chat.loadContacts();
  }
});
</script>

<template>
  <div class="chat-view">
    <template v-if="!needsSetup">
      <!-- Mobile: single pane (list ⇄ conversation) -->
      <template v-if="isMobile">
        <ChatList v-if="showListOnMobile" class="pane-full" />
        <ChatWindow v-else class="pane-full" />
      </template>

      <!-- Desktop: two panes -->
      <template v-else>
        <ChatList class="list" />
        <ChatWindow class="window-pane" />
      </template>
    </template>

    <div v-else class="welcome">
      <div class="welcome-inner">
        <img src="/logo.svg" alt="AstrBot+" width="96" height="96" />
        <h1 class="text-h5 mt-4">欢迎使用 AstrBot+</h1>
        <p class="text-medium-emphasis mt-2 text-center">
          连接到 AstrBot+ 配套插件，即可与 WebUI「创建机器人」里创建的 Agent 对话。
        </p>
        <ConnectionDialog class="mt-4" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-view {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  height: 100%;
}
.list {
  width: 340px;
  flex: 0 0 340px;
  border-right: 1px solid rgba(128, 150, 170, 0.16);
}
.window-pane {
  flex: 1 1 auto;
  min-width: 0;
}
/* Mobile single pane fills the whole area. */
.pane-full {
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
}
.welcome {
  flex: 1;
  display: grid;
  place-items: center;
}
.welcome-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 440px;
}
</style>
