<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{ busy?: boolean }>();
const emit = defineEmits<{ (e: "send", text: string): void }>();

const text = ref("");
const el = ref<HTMLTextAreaElement | null>(null);
const root = ref<HTMLElement | null>(null);

function resize() {
  const t = el.value;
  if (!t) return;
  t.style.height = "auto";
  t.style.height = `${Math.min(t.scrollHeight, 140)}px`;
}

watch(text, () => nextTick(resize));

/**
 * Keyboard-safe anchoring.
 *
 * The primary fix is global: the fixed `.app-shell` is bound to
 * `window.visualViewport` (see `useVisualViewport`), so the whole layout — and
 * therefore this composer — is always pinned to the visible area directly above
 * the on-screen keyboard.
 *
 * As a second layer of defence (embedded/WebView contexts where the document
 * itself still scrolls), we re-anchor the composer into view whenever the
 * visual viewport changes or the field is focused, guaranteeing the input bar
 * is never covered by the IME.
 */
let vv: VisualViewport | null = null;

function anchor() {
  const node = root.value;
  if (!node) return;
  const vvBottom = vv ? vv.height + vv.offsetTop : window.innerHeight;
  const overflow = node.getBoundingClientRect().bottom - vvBottom;
  if (overflow > 1) window.scrollBy(0, overflow);
}

function scheduleAnchor() {
  requestAnimationFrame(anchor);
  window.setTimeout(anchor, 60);
  window.setTimeout(anchor, 300);
}

function onFocus() {
  scheduleAnchor();
}

function onBlur() {
  scheduleAnchor();
}

onMounted(() => {
  vv = window.visualViewport ?? null;
  vv?.addEventListener("resize", anchor);
  vv?.addEventListener("scroll", anchor);
});

onBeforeUnmount(() => {
  vv?.removeEventListener("resize", anchor);
  vv?.removeEventListener("scroll", anchor);
});

function submit() {
  const value = text.value.trim();
  if (!value || props.busy) return;
  emit("send", value);
  text.value = "";
  nextTick(resize);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    submit();
  }
}
</script>

<template>
  <footer ref="root" class="composer">
    <div class="composer-inner">
      <textarea
        ref="el"
        v-model="text"
        class="input"
        rows="1"
        enterkeyhint="send"
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
  position: relative;
  z-index: 5;
  background: rgb(var(--v-theme-surface));
  border-top: 1px solid rgba(128, 150, 170, 0.14);
  /* Clear the home indicator / gesture bar; the shell already sits above the
     keyboard, so only the safe-area inset is added here. */
  padding: 8px 12px calc(10px + env(safe-area-inset-bottom, 0px));
}
.composer-inner {
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
  max-height: 140px;
  overflow-y: auto;
  padding: 8px 0;
  font-family: inherit;
}
.input::placeholder {
  color: rgba(150, 165, 180, 0.7);
}
</style>
