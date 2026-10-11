<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{ name?: string; seed?: string; size?: number }>(),
  { name: "", seed: "", size: 46 },
);

/* Telegram's avatar palette. */
const PALETTE = [
  "#cc5049",
  "#d67722",
  "#955cdb",
  "#40a920",
  "#368ad1",
  "#c7508b",
  "#eb7050",
];

const background = computed(() => {
  const s = props.seed || props.name || "?";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
});

const initial = computed(() => (props.name || "?").trim().charAt(0).toUpperCase());

const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  background: background.value,
  fontSize: `${Math.round(props.size * 0.42)}px`,
}));
</script>

<template>
  <div class="avatar" :style="style">{{ initial }}</div>
</template>

<style scoped>
.avatar {
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  font-weight: 600;
  flex: 0 0 auto;
  user-select: none;
}
</style>
