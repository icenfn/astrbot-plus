<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useEventListener } from "@vueuse/core";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import { useChatStore } from "@/stores/chat";
import { useSettingsStore } from "@/stores/settings";
import { usePlatform } from "@/composables/usePlatform";
import { notify } from "@/composables/useNotify";
import AstrbotAvatar from "./AstrbotAvatar.vue";
import MessageBubble from "./MessageBubble.vue";
import MessageComposer from "./MessageComposer.vue";

const chat = useChatStore();
const settings = useSettingsStore();
const router = useRouter();
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
  // Leave the conversation by moving the route back to the list. Because the
  // open Agent is route-driven (see ChatView), this reliably returns to the
  // chats 首页 on mobile instead of leaving the view stuck.
  void router.push("/");
}

/** Open the Agent info page (bot_id + partial config) for the active Agent. */
function openInfo() {
  if (activeAgent.value) void router.push(`/agent/${encodeURIComponent(activeAgent.value.id)}`);
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
  void scrollToBottom(true);
});
// 视口变化时保持滚动到底部（@vueuse/core 自动解绑）。
useEventListener(() => window.visualViewport, "resize", onViewportResize);
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
          <div class="head-sub">Agent</div>
        </div>
        <v-btn
          icon="mdi-information-outline"
          variant="text"
          size="small"
          class="info-btn"
          title="Agent 信息"
          @click="openInfo"
        />
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
          <v-btn
            v-if="showJumpButton"
            class="jump-btn"
            icon="mdi-arrow-down"
            size="small"
            variant="flat"
            title="回到底部"
            @click="jumpToBottom"
          />
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
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.back-btn {
  margin-left: -8px;
}
.head-meta {
  flex: 1 1 auto;
  min-width: 0;
}
.info-btn {
  flex: 0 0 auto;
  margin-right: -6px;
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
  z-index: 5;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
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
