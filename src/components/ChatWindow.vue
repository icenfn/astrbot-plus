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
const { activeTarget, activeThread, activeKey } = storeToRefs(chat);
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
 *
 * `force` jumps regardless of the current position (used when a message is
 * sent, when a different conversation is opened, or on first mount); otherwise
 * the jump only happens while the user is already pinned to the bottom, so
 * reading history is not interrupted by an incoming/streaming message.
 *
 * We jump *instantly* (temporarily overriding `scroll-behavior: smooth`) and
 * then re-assert the position across the next few frames. A single
 * `scrollTop = scrollHeight` on the frame the conversation appears is not
 * enough: the messages (markdown / KaTeX / images) and even the virtual
 * keyboard keep changing the content height for a few hundred milliseconds
 * afterwards, which is exactly why "进入聊天页没有滚到底部" happened.
 */
async function scrollToBottom(force = false) {
  if (!force && !pinned.value) return;
  await nextTick();
  jumpToEnd();
  requestAnimationFrame(() => {
    jumpToEnd();
    requestAnimationFrame(jumpToEnd);
  });
  // Two delayed passes cover late font / image / markdown layout.
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

/** Floating "jump to bottom" button: shown only while reading history. */
const showJumpButton = computed(() => !pinned.value);

function jumpToBottom() {
  pinned.value = true;
  void scrollToBottom(true);
}

const isGroup = computed(() => activeTarget.value?.kind === "group");

const subtitle = computed(() => {
  const t = activeTarget.value;
  if (!t) return "";
  if (t.kind === "group") {
    const names = (t.members || []).map((m) => m.name).join("、");
    return `群聊 · ${t.members?.length ?? 0} 个 AI${names ? `（${names}）` : ""}`;
  }
  return "AI 好友 · 私聊";
});

// A new message appears (send): always jump to the bottom.
watch(() => activeThread.value.messages.length, () => scrollToBottom(true));
// Streaming text grows token by token: keep the view pinned to the bottom.
watch(
  () => activeThread.value.messages.map((m) => m.text).join(""),
  () => scrollToBottom(),
);
// Opening a different conversation: reset the pin and land at the bottom.
watch(activeKey, () => {
  pinned.value = true;
  scrollToBottom(true);
});

function closeChat() {
  chat.activeKey = "";
}

async function onSend(text: string) {
  const target = activeTarget.value;
  if (!target) return;
  await scrollToBottom(true);
  await chat.sendMessage(text);

  // Raise a system notification for the reply if the app is in the background.
  const msgs = activeThread.value.messages;
  const last = msgs[msgs.length - 1];
  if (settings.settings.notifyEnabled && last && last.role === "assistant" && !last.error) {
    notify({
      title: target.displayName,
      body: (last.text || "").slice(0, 120),
      onlyWhenUnfocused: settings.settings.notifyOnlyBackground,
    });
  }
}

// Keep the view pinned when the (mobile) keyboard opens/closes.
function onViewportResize() {
  if (pinned.value) void scrollToBottom(true);
}
onMounted(() => {
  window.visualViewport?.addEventListener("resize", onViewportResize);
  // The window can mount with a conversation already active (mobile single-pane
  // navigation), where the activeKey watcher never fires — so jump to the bottom
  // explicitly on mount as well.
  void scrollToBottom(true);
});
onBeforeUnmount(() => {
  window.visualViewport?.removeEventListener("resize", onViewportResize);
});
</script>

<template>
  <section class="window">
    <template v-if="activeTarget">
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
          :name="activeTarget.displayName"
          :seed="activeTarget.avatarSeed"
          :group="isGroup"
          :size="42"
        />
        <div class="head-meta">
          <div class="head-name">{{ activeTarget.displayName }}</div>
          <div class="head-sub">{{ subtitle }}</div>
        </div>
      </header>

      <div class="messages-wrap">
        <div ref="scrollEl" class="messages chat-scroll" @scroll.passive="onMessagesScroll">
          <div v-if="!activeThread.messages.length" class="hint">
            <v-icon icon="mdi-message-outline" size="34" class="mb-2" />
            <p>
              {{ isGroup ? "发送一条消息，群里的每个 AI 都会回复。" : "还没有消息，发送一条开始对话吧。" }}
            </p>
          </div>
          <MessageBubble
            v-for="(m, i) in activeThread.messages"
            :key="i"
            :message="m"
            :self="m.role === 'user'"
            :show-sender="isGroup"
          />
        </div>

        <!-- Floating jump-to-bottom button: only while reading history. -->
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
        <h3 class="mt-3">选择一位 AI 好友或群聊开始聊天</h3>
        <p class="text-medium-emphasis">支持与 AI 私聊，或把多个 AI 拉进同一个群聊</p>
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
/* Wrapper anchors the floating jump button to the message area. */
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
  /* Keep the latest message above the on-screen keyboard / composer. */
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
/* Floating "jump to bottom" button, sitting just above the composer. */
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
