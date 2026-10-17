<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useEventListener } from "@vueuse/core";
import { usePlatform } from "@/composables/usePlatform";

/**
 * MessageComposer — the conversation input bar.
 *
 * • Multi-line: a growing textarea (Shift+Enter / Enter inserts a newline), capped
 *   at a modest height so the bar stays slim.
 * • Full-page editing: the "expand" button opens a full-screen sheet with the same
 *   text, useful for long prompts on a phone.
 * • Send behaviour: on DESKTOP Enter sends (Shift+Enter newlines); on MOBILE only the
 *   explicit send button sends, so the on-screen keyboard's Enter just adds a line.
 */
const props = defineProps<{ busy?: boolean }>();
const emit = defineEmits<{ (e: "send", text: string): void }>();

const { isMobile } = usePlatform();

const text = ref("");
const el = ref<HTMLTextAreaElement | null>(null);
const sheetEl = ref<HTMLTextAreaElement | null>(null);
const focused = ref(false);
const expanded = ref(false);

/** Auto-grow the inline textarea, capped so the bar never dominates the screen. */
function resize() {
  const t = el.value;
  if (!t) return;
  t.style.height = "auto";
  const max = Math.max(64, Math.min(window.innerHeight * 0.24, 120));
  t.style.height = `${Math.min(t.scrollHeight, max)}px`;
}

watch(text, () => nextTick(resize));

/**
 * Reflow guard for the on-screen keyboard — the shell is pinned to the visual
 * viewport, so this only re-asserts the layout after the keyboard animates in.
 */
function reflow() {
  const t = el.value;
  if (!t || !focused.value) return;
  resize();
  t.scrollIntoView({ block: "nearest" });
}

let timers: number[] = [];
function scheduleReflow() {
  timers.forEach((id) => window.clearTimeout(id));
  timers = [0, 60, 180, 360, 560].map((ms) => window.setTimeout(reflow, ms));
}

function onFocus() {
  focused.value = true;
  document.documentElement.classList.add("composer-focused");
  scheduleReflow();
}

function onBlur() {
  focused.value = false;
  document.documentElement.classList.remove("composer-focused");
}

function onViewportResize() {
  if (focused.value) reflow();
}

useEventListener(() => window.visualViewport, "resize", onViewportResize);
useEventListener(() => window.visualViewport, "scroll", onViewportResize);
useEventListener(window, "resize", onViewportResize);
useEventListener(window, "astrbot:viewport", onViewportResize);

onBeforeUnmount(() => {
  timers.forEach((id) => window.clearTimeout(id));
  document.documentElement.classList.remove("composer-focused");
});

function submit() {
  const value = text.value.trim();
  if (!value || props.busy) return;
  emit("send", value);
  text.value = "";
  expanded.value = false;
  nextTick(resize);
}

function onKeydown(e: KeyboardEvent) {
  // Desktop only: Enter sends, Shift+Enter newlines. On mobile the Enter key must
  // simply insert a line — sending is left to the explicit button.
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !isMobile.value) {
    e.preventDefault();
    submit();
  }
}

function openSheet() {
  expanded.value = true;
  nextTick(() => sheetEl.value?.focus());
}
</script>

<template>
  <footer class="composer">
    <div class="box">
      <textarea
        ref="el"
        v-model="text"
        class="input"
        rows="1"
        enterkeyhint="enter"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="sentences"
        spellcheck="false"
        placeholder="输入消息"
        @focus="onFocus"
        @blur="onBlur"
        @keydown="onKeydown"
      ></textarea>

      <v-btn
        icon="mdi-arrow-expand"
        variant="text"
        size="small"
        class="expand-btn"
        title="整页编辑"
        :ripple="false"
        @click="openSheet"
      />

      <v-btn
        icon="mdi-send"
        color="primary"
        variant="flat"
        size="small"
        class="send-btn"
        :disabled="!text.trim() || busy"
        :loading="busy"
        @click="submit"
      />
    </div>

    <!-- Full-page editing sheet -->
    <v-dialog v-model="expanded" fullscreen transition="dialog-bottom-transition">
      <div class="sheet">
        <div class="sheet-head">
          <v-btn
            icon="mdi-close"
            variant="text"
            :ripple="false"
            title="关闭"
            @click="expanded = false"
          />
          <span class="sheet-title">编辑消息</span>
          <v-btn
            color="primary"
            variant="text"
            :disabled="!text.trim() || busy"
            @click="submit"
          >
            发送
          </v-btn>
        </div>
        <textarea
          ref="sheetEl"
          v-model="text"
          class="sheet-input"
          placeholder="输入消息…"
          @keydown="onKeydown"
        ></textarea>
      </div>
    </v-dialog>
  </footer>
</template>

<style scoped>
.composer {
  flex: 0 0 auto;
  padding: 6px 12px calc(8px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
  background: rgb(var(--v-theme-surface));
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}
.box {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  background: rgb(var(--v-theme-surface-variant));
  border-radius: 20px;
  padding: 3px 4px 3px 14px;
}
.input {
  flex: 1 1 auto;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-size: 15px; /* >=16px would prevent zoom; 15px keeps the bar slim */
  line-height: 1.45;
  max-height: 120px;
  overflow-y: auto;
  padding: 8px 0;
  font-family: inherit;
}
.input::placeholder {
  color: rgba(var(--v-theme-on-surface), 0.45);
}
.expand-btn,
.send-btn {
  flex: 0 0 auto;
  margin-bottom: 1px;
}

/* Full-page editor */
.sheet {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
  padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
}
.sheet-head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}
.sheet-title {
  font-size: 15px;
  font-weight: 600;
}
.sheet-input {
  flex: 1 1 auto;
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-size: 16px;
  line-height: 1.55;
  padding: 16px;
  font-family: inherit;
}
</style>
