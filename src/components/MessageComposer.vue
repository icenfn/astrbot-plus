<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useEventListener } from "@vueuse/core";
import { usePlatform } from "@/composables/usePlatform";

/**
 * MessageComposer — the conversation input bar.
 *
 * 布局（本轮调整）：发送按钮**移出**白色编辑框，放在编辑框右侧独立成列，
 * 因此输入区宽度不再被按钮挤占，长文本编辑更从容；展开按钮则贴到编辑框
 * 内部的**最右侧**（原来被发送按钮挡住，只能停在 right:40px）。
 *
 * • 白色编辑框：两种主题下都是白底 + 浅阴影，视觉上明确是「输入位」。
 * • 单行→多行自适应：逐行计算高度，单行永不出现滚动条；超过 MAX_LINES 才滚。
 * • 草稿超过两行时，编辑框右上角淡入「整页编辑」按钮，打开全屏编辑器。
 * • 桌面端 Enter 发送、Shift+Enter 换行；移动端只由发送按钮发送。
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
// 单行高度 = LINE_HEIGHT + PAD_Y = 22 + 22 = 44px，与发送按钮等高。
const LINE_HEIGHT = 22;
const PAD_Y = 22;
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
    <!-- 编辑区与发送按钮并排：发送按钮在白色编辑框**外侧右侧**。 -->
    <div class="bar">
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

        <!-- 紧贴编辑框右上角（最右侧），仅在两行以上时出现。 -->
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
      </div>

      <v-btn
        icon="mdi-send"
        color="primary"
        variant="flat"
        size="default"
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
/* 编辑框 + 发送按钮 横向排布，底对齐，两者**等高**（44px），
   否则按钮会半悬在输入框右下角，看起来「不搭」。 */
.bar {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}
.box {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: flex-end;
  /* 主题化的填充式输入位：深浅主题都取 surface-variant，
     不再硬编码纯白（浅色主题下白底白边几乎看不见边界）。 */
  background: rgb(var(--v-theme-surface-variant));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 22px;
  min-height: 44px;
  padding: 0 12px;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;
}
.box:focus-within {
  border-color: rgba(var(--v-theme-primary), 0.75);
}
/* Room for the floating expand button so it never covers the first line. */
.box.has-expand .input {
  padding-right: 26px;
}
.input {
  flex: 1 1 auto;
  min-width: 0;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-size: 15px;
  line-height: 22px;
  height: 44px;
  overflow-y: hidden;
  /* 上下各 11px = PAD_Y/2，单行总高 44px，与发送按钮完全对齐。 */
  padding: 11px 0;
  font-family: inherit;
}
.input::placeholder {
  color: rgba(var(--v-theme-on-surface), 0.45);
}
/* 贴紧编辑框最右侧（不再为发送按钮让位）。 */
.expand-btn {
  position: absolute;
  top: 3px;
  right: 3px;
  z-index: 2;
  width: 22px;
  height: 22px;
  background: rgba(var(--v-theme-on-surface), 0.09);
  box-shadow: none;
}
/* 发送按钮：与编辑框同高同色的「圆形主操作」，不再是孤零零的小图标。 */
.send-btn {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  min-width: 0;
  border-radius: 50%;
  margin: 0;
  box-shadow: 0 2px 8px rgba(var(--v-theme-primary), 0.32);
  transition:
    box-shadow 0.18s ease,
    transform 0.18s ease;
}
.send-btn:not(.v-btn--disabled) {
  box-shadow: 0 3px 12px rgba(var(--v-theme-primary), 0.42);
}
.send-btn.v-btn--disabled {
  box-shadow: none;
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
