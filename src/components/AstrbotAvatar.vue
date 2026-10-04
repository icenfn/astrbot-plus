<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    name: string;
    seed?: string;
    size?: number;
    group?: boolean;
  }>(),
  { seed: "", size: 46, group: false },
);

// Deterministic Telegram-style gradient derived from the seed string.
const palette = [
  ["#e17076", "#b04a52"],
  ["#7bc862", "#3f8f2f"],
  ["#65aadd", "#2f6fae"],
  ["#a695e7", "#6a52c4"],
  ["#ee7aae", "#c2417f"],
  ["#faa774", "#d97a2e"],
  ["#6ec9cb", "#2f9a9d"],
  ["#f0a95c", "#c77d1e"],
];

const colors = computed(() => {
  const key = props.seed || props.name || "?";
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
});

const initials = computed(() => {
  const n = (props.name || "?").trim();
  if (!n) return "?";
  // For CJK names take the last char; otherwise the first letter.
  if (/[\u4e00-\u9fa5]/.test(n)) return n.slice(-1);
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
});

const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.round(props.size * 0.4)}px`,
  background: `linear-gradient(135deg, ${colors.value[0]}, ${colors.value[1]})`,
}));
</script>

<template>
  <div class="avatar" :style="style">
    <v-icon v-if="group" icon="mdi-account-group" :size="Math.round(size * 0.5)" />
    <span v-else>{{ initials }}</span>
  </div>
</template>

<style scoped>
.avatar {
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 600;
  flex: 0 0 auto;
  user-select: none;
  letter-spacing: 0.5px;
}
</style>
