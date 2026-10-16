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

// ---------------------------------------------------------------------------
// Floating, auto-hiding scrollbar
// The message list is a plain scroll container (not a Vuetify scroll component),
// so its native scrollbar would (a) reserve layout width and (b) stay visible.
// We therefore hide the native bar and paint our own thumb that floats over the
// content (never occupying space), appears while scrolling, and fades out after a
// short idle delay. It is also draggable.
// ---------------------------------------------------------------------------
const barVisible = ref(false);
const barScrollable = ref(false);
const thumbTop = ref(0);
const thumbHeight = ref(0);
let barHideTimer: number | undefined;
let dragging = false;
let dragStartY = 0;
let dragStartTop = 0;

function computeBar() {
  const el = scrollEl.value;
  if (!el) return;
  const { clientHeight, scrollHeight, scrollTop } = el;
  barScrollable.value = scrollHeight - clientHeight > 1;
  if (!barScrollable.value) {
    barVisible.value = false;
    return;
  }
  const th = Math.max(32, (clientHeight / scrollHeight) * clientHeight);
  thumbHeight.value = th;
  const maxScroll = scrollHeight - clientHeight;
  const maxThumb = clientHeight - th;
  thumbTop.value = maxScroll > 0 ? (scrollTop / maxScroll) * maxThumb : 0;
}

function revealBar() {
  const el = scrollEl.value;
  if (!el) return;
  computeBar();
  if (!barScrollable.value) return;
  barVisible.value = true;
  window.clearTimeout(barHideTimer);
  barHideTimer = window.setTimeout(() => {
    if (!dragging) barVisible.value = false;
  }, 900);
}

function onScroll() {
  onMessagesScroll();
  revealBar();
}

function onBarDown(e: PointerEvent) {
  const el = scrollEl.value;
  if (!el) return;
  dragging = true;
  window.clearTimeout(barHideTimer);
  computeBar();
  barVisible.value = true;
  dragStartY = e.clientY;
  dragStartTop = thumbTop.value;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  e.preventDefault();
}

function onBarMove(e: PointerEvent) {
  if (!dragging) return;
  const el = scrollEl.value;
  if (!el) return;
  const maxScroll = el.scrollHeight - el.clientHeight;
  const maxThumb = el.clientHeight - thumbHeight.value;
  if (maxThumb <= 0) return;
  let next = dragStartTop + (e.clientY - dragStartY);
  next = Math.max(0, Math.min(maxThumb, next));
  thumbTop.value = next;
  el.scrollTop = (next / maxThumb) * maxScroll;
}

function onBarUp(e: PointerEvent) {
  if (!dragging) return;
  dragging = false;
  try {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  } catch {
    /* pointer capture may already be released */
  }
  window.clearTimeout(barHideTimer);
  barHideTimer = window.setTimeout(() => {
    if (!dragging) barVisible.value = false;
  }, 900);
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
  window.setTimeout(computeBar, 260);
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
  else computeBar();
}
onMounted(() => {
  computeBar();
  void scrollToBottom(true);
});
// 视口变化时保持滚动到底部（@vueuse/core 自动解绑）。
useEventListener(() => window.visualViewport, "resize", onViewportResize);
// The native shell reports the on-screen keyboard height through this event, so
// the list re-pins to the bottom when the composer shifts above the keyboard.
useEventListener(window, "astrbot:viewport", onViewportResize);
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
        <div
          ref="scrollEl"
          class="messages chat-scroll"
          @scroll.passive="onScroll"
        >
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

        <!-- Floating, auto-hiding scrollbar (does not occupy layout space). -->
        <div
          v-show="barScrollable"
          class="scrollbar"
          :class="{ 'is-visible': barVisible }"
          aria-hidden="true"
        >
          <div
            class="scrollbar-thumb"
            :style="{ height: `${thumbHeight}px`, transform: `translateY(${thumbTop}px)` }"
            @pointerdown="onBarDown"
            @pointermove="onBarMove"
            @pointerup="onBarUp"
            @pointercancel="onBarUp"
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
  background: rgb(var(--v-theme-surface));
}
.head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  /* Top safe area: clear the status bar / notch on edge-to-edge mobile. */
  padding: calc(12px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px))) 16px 12px;
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
  /* Hide the native scrollbar; a floating custom thumb is drawn instead. */
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.messages::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
/* Floating scrollbar overlay — absolutely positioned, never takes layout space. */
.scrollbar {
  position: absolute;
  top: 4px;
  bottom: 4px;
  right: 3px;
  width: 8px;
  z-index: 4;
  opacity: 0;
  transition: opacity 0.25s ease;
  pointer-events: none;
}
.scrollbar.is-visible {
  opacity: 1;
}
.scrollbar-thumb {
  width: 6px;
  margin-left: 1px;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.32);
  pointer-events: auto;
  touch-action: none;
  will-change: transform;
  cursor: default;
}
.scrollbar-thumb:hover,
.scrollbar-thumb:active {
  background: rgba(var(--v-theme-on-surface), 0.5);
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
