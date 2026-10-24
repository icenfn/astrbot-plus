<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useSettingsStore } from "@/stores/settings";

/** 统一头像组件：服务端图片优先，全部取不到才用本地占位图。 */
const props = withDefaults(
  defineProps<{
    name?: string;
    src?: string;
    type?: "user" | "agent";
    size?: number;
  }>(),
  { name: "", src: "", type: "user", size: 46 },
);

const settings = useSettingsStore();

const LOCAL_PLACEHOLDER: Record<"user" | "agent", string> = {
  user: "/default_user_avatar.png",
  agent: "/default_agent_avatar.png",
};

/** 服务端默认头像地址（由插件 /api/avatar/default 提供）。 */
const serverDefault = computed(() => {
  const raw = (settings.settings.serverUrl || "").trim();
  if (!raw) return "";
  const base = /^https?:\/\//i.test(raw)
    ? raw.replace(/\/+$/, "")
    : `http://${raw.replace(/\/+$/, "")}`;
  return `${base}/api/avatar/default?type=${props.type}`;
});

/** 候选地址按优先级排列：服务端下发 → 服务端默认 → 本地占位。 */
const candidates = computed(() => {
  const list = [props.src || "", serverDefault.value, LOCAL_PLACEHOLDER[props.type]];
  return list.filter((u, i) => !!u && list.indexOf(u) === i);
});

const idx = ref(0);
watch(candidates, () => {
  idx.value = 0;
});

const url = computed(() => candidates.value[idx.value] || LOCAL_PLACEHOLDER[props.type]);

const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}));

function onError(): void {
  if (idx.value < candidates.value.length - 1) idx.value += 1;
}
</script>

<template>
  <div class="avatar" :style="style">
    <img
      :src="url"
      :alt="name || ''"
      :title="name || ''"
      loading="lazy"
      decoding="async"
      @error="onError"
    />
  </div>
</template>

<style scoped>
.avatar {
  flex: 0 0 auto;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(var(--v-theme-on-surface), 0.08);
  user-select: none;
}
.avatar img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
