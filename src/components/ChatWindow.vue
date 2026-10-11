<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
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
const { activeAgent, activeThread, activeKey } = storeToRefs(chat);
const { isMobile } = usePlatform();

const scrollEl = ref<HTMLElement | null>(null);

/** Whether the view is (still) scrolled to the bottom of the thread. */
const pinned = ref(true);

function onMessagesScroll() {
  const el = scrollEl.value;
  if (!el) return;
  pinned.value = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
}

/**
 * Scroll the message list to the bottom. `force` jumps regardless of position
 * (send / open / mount); otherwise only while already pinned to the bottom.
 * A single scrollTop set is not enough because markdown / images keep changing
 * the content height for a few hundred ms, so we re-assert across frames.
 */
async function scrollToBottom(force = false) {
  if (!force && !pinned.value) return;
  await nextTick();
  jumpToEnd();
  requestAnimationFrame(() => {
    jumpToEnd();
    requestAnimationFrame(jumpToEnd);
  });
  window.setTimeout(jumpToEnd, 80);
  window.setTimeout(jumpToEnd, 240);
}

function jumpToEnd() {
  const el = scrollEl.value;
  if (!el) return;
  const previous = el.style.scrollBehavior;
  el.style.scrollBehavior = "auto";
  el.scrollTop = el.scrollHeight;
  el.style.scrollBehavior = previous;
}

const showJumpButton = computed(() => !pinned.value);

function jumpToBottom() {
  pinned.value = true;
  void scrollToBottom(true);
}

const subtitle = computed(() => "Agent");

watch(() => activeThread.value.messages.length, () => scrollToBottom(true));
watch(
  () => activeThread.value.messages.map((m) => m.text).join(""),
  () => scrollToBottom(),
);
watch(activeKey, () => {
  pinned.value = true;
  scrollToBottom(true);
});

function closeChat() {
  chat.closeActive();
}

async function onSend(text: string) {
  if (!activeAgent.value) return;
  await scrollToBottom(true);
  await chat.sendMessage(text);
  const msgs = activeThread.value.messages;
  const last = msgs[msgs.length - 1];
  if (settings.settings.notifyEnabled && last && last.role === "assistant" && !last.error) {
    notify({
      title: activeAgent.value.name,
      body: (last.text || "").slice(0, 120),
      onlyWhenUnfocused: settings.settings.notifyOnlyBackground,
    });
  }
}

function onViewportResize() {
  if (pinned.value) void scrollToBottom(true);
}
onMounted(() => {
  window.visualViewport?.addEventListener("resize", onViewportResize);
  void scrollToBottom(true);
});
onBeforeUnmount(() => {
  window.visualViewport?.removeEventListener("resize", onViewportResize);
});
</script>

<template>
  <section class="window">
    <template v-if="activeAgent">
      <header class="head">
        <v-btn
          v-if="isMobile"
          icon="mdi-arrow-left"
          variant="text"
          size="small"
          class="back-btn"
          @click="closeChat"
        />
        <AstrbotAvatar :name="activeAgent.name" :seed="activeAgent.avatarSeed" :size="42" />
        <div class="head-meta">
          <div class="head-name">{{ activeAgent.name }}</div>
          <div class="head-sub">{{ subtitle }}</div>
        </div>
      </header>

      <div class="messages-wrap">
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

        <transition name="fade">
          <button
            v-if="showJumpButton"
            class="jump-btn"
            type="button"
            title="回到底部"
            @click="jumpToBottom"
          >
            <v-icon icon="mdi-arrow-down" size="22" />
          </button>
        </transition>
      </div>

      <MessageComposer :busy="activeThread.busy" @send="onSend" />
    </template>

    <div v-else class="placeholder">
      <div class="placeholder-inner">
        <img src="/logo.svg" alt="AstrBot+" width="84" height="84" />
        <h3 class="mt-3">选择一个 Agent 开始聊天</h3>
        <p class="text-medium-emphasis">Agent 来自 WebUI「创建机器人」页面</p>
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60vw;
}
.messages-wrap {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.messages {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 16px clamp(12px, 6vw, 60px);
  display: flex;
  flex-direction: column;
  gap: 2px;
  scroll-padding-bottom: 12px;
  overscroll-behavior: contain;
}
.hint {
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: 0.66;
  text-align: center;
}
.jump-btn {
  position: absolute;
  right: 18px;
  bottom: 14px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid rgba(128, 150, 170, 0.24);
  background: rgb(var(--v-theme-surface-bright, var(--v-theme-surface)));
  color: rgb(var(--v-theme-on-surface));
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
  z-index: 5;
}
.jump-btn:hover {
  background: rgba(47, 134, 189, 0.18);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
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
}
</style>
