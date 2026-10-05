<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useChatStore } from "@/stores/chat";
import { useSettingsStore } from "@/stores/settings";
import { usePlatform } from "@/composables/usePlatform";
import { notify } from "@/composables/useNotify";
import AstrbotAvatar from "./AstrbotAvatar.vue";
import MessageBubble from "./MessageBubble.vue";
import MessageComposer from "./MessageComposer.vue";

const chat = useChatStore();
const settings = useSettingsStore();
const { activeContact, activeThread } = storeToRefs(chat);
const { isMobile } = usePlatform();

const scrollEl = ref<HTMLElement | null>(null);

/** Whether the view is (still) scrolled to the bottom of the thread. */
const pinned = ref(true);

/** Track whether the user is reading at the bottom (or has scrolled up). */
function onMessagesScroll() {
  const el = scrollEl.value;
  if (!el) return;
  pinned.value = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
}

/**
 * Scroll the message list to the bottom.
 * `force` jumps regardless of the current position (used when a message is
 * sent or when a different conversation is opened); otherwise the jump only
 * happens while the user is already pinned to the bottom, so reading history
 * is not interrupted by an incoming/streaming message.
 */
async function scrollToBottom(force = false) {
  await nextTick();
  const el = scrollEl.value;
  if (!el) return;
  if (!force && !pinned.value) return;
  el.scrollTop = el.scrollHeight;
}

const isGroup = computed(() => activeContact.value?.messageType === "GroupMessage");

const platformLabel = computed(() => {
  const p = activeContact.value?.platform || "";
  const map: Record<string, string> = {
    webchat: "WebChat",
    aiocqhttp: "QQ",
    qq_official: "QQ",
    telegram: "Telegram",
    discord: "Discord",
    wechat: "微信",
    weixin: "微信",
    slack: "Slack",
    lark: "飞书",
  };
  return map[p] || p;
});

// A new message appears (history load / send): always jump to the bottom.
watch(() => activeThread.value.messages.length, () => scrollToBottom(true));
// Streaming text grows token by token: keep the view pinned to the bottom.
watch(
  () => activeThread.value.messages.map((m) => m.text).join("\n"),
  () => scrollToBottom(),
);
// Opening a different conversation: reset the pin and land at the bottom.
watch(
  () => activeContact.value?.umo,
  () => {
    pinned.value = true;
    scrollToBottom(true);
  },
);

function closeChat() {
  chat.activeUmo = "";
}

async function onSend(text: string) {
  const contact = activeContact.value;
  if (!contact) return;
  await scrollToBottom(true);
  await chat.sendMessage(text, contact);

  // Raise a system notification for the reply if the app is in the background.
  const last = activeThread.value.messages[activeThread.value.messages.length - 1];
  if (settings.settings.notifyEnabled && last && last.role === "assistant" && !last.error) {
    notify({
      title: contact.displayName,
      body: last.text.slice(0, 120),
      onlyWhenUnfocused: settings.settings.notifyOnlyBackground,
    });
  }
}
</script>

<template>
  <section class="window">
    <template v-if="activeContact">
      <header class="head">
        <v-btn
          v-if="isMobile"
          icon="mdi-arrow-left"
          variant="text"
          size="small"
          class="back-btn"
          @click="closeChat"
        />
        <AstrbotAvatar
          :name="activeContact.displayName"
          :seed="activeContact.avatarSeed"
          :group="isGroup"
          :size="42"
        />
        <div class="head-meta">
          <div class="head-name">{{ activeContact.displayName }}</div>
          <div class="head-sub">
            {{ isGroup ? "群聊" : "单聊" }} · {{ platformLabel }}
          </div>
        </div>
        <v-spacer />
        <v-btn
          icon="mdi-broom"
          variant="text"
          size="small"
          title="清空本地会话记录"
          @click="chat.clearThread(activeContact.umo)"
        />
      </header>

      <div ref="scrollEl" class="messages chat-scroll" @scroll.passive="onMessagesScroll">
        <div v-if="!activeThread.messages.length" class="hint">
          <v-icon icon="mdi-message-outline" size="34" class="mb-2" />
          <p>还没有消息，发送一条开始对话吧。</p>
        </div>
        <MessageBubble
          v-for="(m, i) in activeThread.messages"
          :key="i"
          :message="m"
          :self="m.role === 'user'"
        />
      </div>

      <MessageComposer :busy="activeThread.busy" @send="onSend" />
    </template>

    <div v-else class="placeholder">
      <div class="placeholder-inner">
        <img src="/logo.svg" alt="AstrBot+" width="84" height="84" />
        <h3 class="mt-3">选择一个会话开始聊天</h3>
        <p class="text-medium-emphasis">支持纯文字单聊与群聊</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.window {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
}
.head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(128, 150, 170, 0.14);
}
.back-btn {
  margin-left: -8px;
}
.head-name {
  font-weight: 600;
  font-size: 15.5px;
}
.head-sub {
  font-size: 12px;
  opacity: 0.6;
}
.messages {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 16px clamp(12px, 6vw, 60px);
  display: flex;
  flex-direction: column;
  gap: 2px;
  /* Keep the latest message above the on-screen keyboard / composer. */
  scroll-padding-bottom: 12px;
  overscroll-behavior: contain;
}
.hint {
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: 0.6;
}
.placeholder {
  flex: 1;
  display: grid;
  place-items: center;
}
.placeholder-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
</style>
