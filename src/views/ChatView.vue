<script setup lang="ts">
import { onMounted, computed } from "vue";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "@/stores/settings";
import { useChatStore } from "@/stores/chat";
import { usePlatform } from "@/composables/usePlatform";
import ChatList from "@/components/ChatList.vue";
import ChatWindow from "@/components/ChatWindow.vue";
import ConnectionDialog from "@/components/ConnectionDialog.vue";

const settings = useSettingsStore();
const chat = useChatStore();
const { connected } = storeToRefs(settings);
const { activeKey } = storeToRefs(chat);
const { isMobile } = usePlatform();

const needsSetup = computed(() => !settings.hasCredentials || !connected.value);

// Mobile shows a single pane: the list, or the open conversation.
const showListOnMobile = computed(() => !activeKey.value);

onMounted(async () => {
  if (settings.hasCredentials && !connected.value) {
    const ok = await settings.testConnection();
    if (ok && !chat.contacts.length) await chat.loadContacts();
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
          连接到你的 AstrBot 服务器，与 AI 好友私聊，或把多个 AI 拉进一个群聊。
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
