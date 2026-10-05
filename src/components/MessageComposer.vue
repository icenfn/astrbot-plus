<script setup lang="ts">
import { nextTick, ref, watch } from "vue";

const props = defineProps<{ busy?: boolean }>();
const emit = defineEmits<{ (e: "send", text: string): void }>();

const text = ref("");
const el = ref<HTMLTextAreaElement | null>(null);

function resize() {
  const t = el.value;
  if (!t) return;
  t.style.height = "auto";
  t.style.height = `${Math.min(t.scrollHeight, 140)}px`;
}

watch(text, () => nextTick(resize));

/**
 * Fallback for WebViews without the VisualViewport API.
 *
 * The primary mobile keyboard fix is the fixed-position `.app-shell` bound to
 * `window.visualViewport` (see `useVisualViewport`): the whole layout — and
 * therefore this composer — is pinned to the visible area directly above the
 * on-screen keyboard. Only when that API is unavailable do we nudge the
 * (then-scrollable) composer back into view so it is not covered.
 */
function keepVisible() {
  if (window.visualViewport) return;
  const scroll = () => el.value?.scrollIntoView({ block: "end" });
  setTimeout(scroll, 50);
  setTimeout(scroll, 300);
}

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
  <footer class="composer">
    <div class="box">
      <textarea
        ref="el"
        v-model="text"
        class="input"
        rows="1"
        enterkeyhint="send"
        placeholder="输入消息，Enter 发送，Shift+Enter 换行"
        @focus="keepVisible"
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
  max-height: 140px;
  overflow-y: auto;
  padding: 8px 0;
  font-family: inherit;
}
.input::placeholder {
  color: rgba(150, 165, 180, 0.7);
}
</style>
