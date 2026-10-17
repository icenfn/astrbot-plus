<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useEventListener } from "@vueuse/core";
import { usePlatform } from "@/composables/usePlatform";

/**
 * MessageComposer — the conversation input bar.
 *
 * • WHITE field on both themes, sitting on a tinted bar so it reads as an input.
 * • Auto-growing single→multi line. The textarea height is computed per line so a
 *   ONE-line message can never show a scrollbar (the old fixed max-height left a
 *   scrollbar on a single line); scrolling only kicks in past MAX_LINES.
 * • Once the draft exceeds TWO lines, a floating "expand" button fades in at the
 *   input's top-right corner and opens a full-screen editor.
 * • Desktop: Enter sends, Shift+Enter newlines. Mobile: only the send button sends.
 */
const props = defineProps<{ busy?: boolean }>();
const emit = defineEmits<{ (e: "send", text: string): void }>();

const { isMobile } = usePlatform();

const text = ref("");
const el = ref<HTMLTextAreaElement | null>(null);
const sheetEl = ref<HTMLTextAreaElement | null>(null);
const focused = ref(false);
const expanded = ref(false);

// Keep these in sync with the .input CSS below.
const LINE_HEIGHT = 22;
const PAD_Y = 16;
const MAX_LINES = 5;

const lineCount = ref(1);
/** Only show the expand affordance once the draft no longer fits in two lines. */
const canExpand = computed(() => lineCount.value > 2);

function measure(): void {
  const t = el.value;
  if (!t) return;
  // Collapse first so scrollHeight reflects the real content height.
  t.style.height = "auto";
  const content = Math.max(0, t.scrollHeight - PAD_Y);
  const lines = Math.max(1, Math.round(content / LINE_HEIGHT) || 1);
  lineCount.value = lines;
  const shown = Math.min(lines, MAX_LINES);
  t.style.height = `${shown * LINE_HEIGHT + PAD_Y}px`;
  // No scrollbar unless we actually overflow the capped height.
  t.style.overflowY = lines > MAX_LINES ? "auto" : "hidden";
}

watch(text, () => nextTick(measure));

function reflow() {
  const t = el.value;
  if (!t || !focused.value) return;
  measure();
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
  nextTick(measure);
}

function onKeydown(e: KeyboardEvent) {
  // Desktop only: Enter sends. On mobile Enter must just insert a line.
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
    <div class="box" :class="{ 'has-expand': canExpand }">
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

      <!-- Floating above the input's top-right corner, only past two lines. -->
      <transition name="pop">
        <v-btn
          v-if="canExpand"
          icon="mdi-arrow-expand"
          variant="flat"
          size="x-small"
          class="expand-btn"
          title="整页编辑"
          :ripple="false"
          @click="openSheet"
        />
      </transition>

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
  padding: 6px 10px calc(8px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
  background: rgb(var(--v-theme-surface));
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}
.box {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 4px;
  /* White input field on a tinted track, in both themes. */
  background: #ffffff;
  border-radius: 20px;
  padding: 2px 4px 2px 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}
/* Room for the floating expand button so it never covers the first line. */
.box.has-expand .input {
  padding-right: 26px;
}
.input {
  flex: 1 1 auto;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: #16202b;
  font-size: 15px;
  line-height: 22px;
  height: 38px;
  overflow-y: hidden;
  padding: 8px 0;
  font-family: inherit;
}
.input::placeholder {
  color: rgba(22, 32, 43, 0.42);
}
.expand-btn {
  position: absolute;
  top: 2px;
  right: 40px;
  z-index: 2;
  background: rgba(22, 32, 43, 0.08);
  box-shadow: none;
}
.send-btn {
  flex: 0 0 auto;
  margin-bottom: 1px;
}
.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: scale(0.8);
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
