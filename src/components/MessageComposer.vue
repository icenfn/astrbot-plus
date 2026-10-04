<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{ busy?: boolean }>();
const emit = defineEmits<{ (e: "send", text: string): void }>();

const text = ref("");

function submit() {
  const value = text.value.trim();
  if (!value || props.busy) return;
  emit("send", value);
  text.value = "";
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
        v-model="text"
        class="input"
        rows="1"
        placeholder="输入消息，Enter 发送，Shift+Enter 换行"
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
  padding: 10px 16px 14px;
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
  font-size: 14.5px;
  line-height: 1.5;
  max-height: 140px;
  padding: 8px 0;
  font-family: inherit;
}
.input::placeholder {
  color: rgba(150, 165, 180, 0.7);
}
</style>
