<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{ busy?: boolean }>();
const emit = defineEmits<{ (e: "send", text: string): void }>();

const text = ref("");
const el = ref<HTMLTextAreaElement | null>(null);
const focused = ref(false);

/**
 * Auto-grow the textarea up to a cap. We keep a single source of truth for the
 * height so the composer can never overshoot the available space on mobile.
 */
function resize() {
  const t = el.value;
  if (!t) return;
  t.style.height = "auto";
  const max = Math.max(96, Math.min(window.innerHeight * 0.34, 180));
  t.style.height = `${Math.min(t.scrollHeight, max)}px`;
}

watch(text, () => nextTick(resize));

/**
 * Reflow guard for the on-screen keyboard.
 *
 * The app shell is pinned to `window.visualViewport` (see `useVisualViewport`),
 * so opening the keyboard shrinks the shell — and this composer with it — to the
 * visible area. The remaining issue is *timing*: the keyboard animates in over
 * ~250ms while the layout viewport may not shrink at all on some WebViews, so
 * the browser can still auto-scroll the focused field. We therefore re-assert
 * the layout on every visualViewport `resize` while focused, and blur-guard the
 * body scroll so the composer can never be pushed off-screen behind the IME.
 */
function reflow() {
  const t = el.value;
  if (!t || !focused.value) return;
  resize();
  // Pull the composer fully into view above the keyboard.
  t.scrollIntoView({ block: "nearest" });
}

let timers: number[] = [];
function scheduleReflow() {
  timers.forEach((id) => window.clearTimeout(id));
  timers = [0, 60, 180, 360, 560].map((ms) => window.setTimeout(reflow, ms));
}

function onFocus() {
  focused.value = true;
  // Prevent the browser from scrolling the whole (fixed) shell on focus.
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

onMounted(() => {
  window.visualViewport?.addEventListener("resize", onViewportResize);
  window.visualViewport?.addEventListener("scroll", onViewportResize);
  // Fallback for WebViews where the visual viewport events are flaky.
  window.addEventListener("resize", onViewportResize);
  resize();
});

onBeforeUnmount(() => {
  timers.forEach((id) => window.clearTimeout(id));
  window.visualViewport?.removeEventListener("resize", onViewportResize);
  window.visualViewport?.removeEventListener("scroll", onViewportResize);
  window.removeEventListener("resize", onViewportResize);
  document.documentElement.classList.remove("composer-focused");
});

function submit() {
  const value = text.value.trim();
  if (!value || props.busy) return;
  emit("send", value);
  text.value = "";
  nextTick(resize);
}

function onKeydown(e: KeyboardEvent) {
  // Never submit while an IME (e.g. Chinese pinyin) composition is active.
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    submit();
  }
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
        enterkeyhint="send"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="sentences"
        spellcheck="false"
        placeholder="输入消息，Enter 发送，Shift+Enter 换行"
        @focus="onFocus"
        @blur="onBlur"
        @keydown="onKeydown"
      ></textarea>
      <v-btn
        icon="mdi-send"
        color="primary"
        variant="flat"
        size="small"
        :disabled="!text.trim() || busy"
        :loading="busy"
        @click="submit"
      />
    </div>
  </footer>
</template>

<style scoped>
.composer {
  flex: 0 0 auto;
  /* extra bottom padding clears the home indicator / gesture bar */
  padding: 10px 16px calc(14px + env(safe-area-inset-bottom, 0px));
  background: rgb(var(--v-theme-surface));
  border-top: 1px solid rgba(128, 150, 170, 0.14);
}
.box {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: rgb(var(--v-theme-surface-variant));
  border-radius: 22px;
  padding: 6px 6px 6px 16px;
}
.input {
  flex: 1 1 auto;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-size: 16px; /* >=16px prevents mobile browsers from auto-zooming the field */
  line-height: 1.5;
  max-height: 180px;
  overflow-y: auto;
  padding: 8px 0;
  font-family: inherit;
}
.input::placeholder {
  color: rgba(150, 165, 180, 0.7);
}
</style>
