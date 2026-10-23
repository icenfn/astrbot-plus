<script setup lang="ts">
import { computed, ref, watch } from "vue";

/**
 * AstrbotAvatar — 统一头像组件（图片版）。
 *
 * 不再使用「字符 + 随机底色」的本地生成方案：头像由服务端下发（`avatar`
 * 字段，data-URI 或 http(s) URL），客户端只负责渲染与本地缓存。字段为空时
 * 回落到随包发布的默认头像（用户 / 智能体各一张）。
 */
const props = withDefaults(
  defineProps<{
    name?: string;
    /** 服务端下发的 avatar（data-URI / URL）。空串表示使用默认头像。 */
    src?: string;
    /** 默认头像种类：user = 用户，agent = 智能体。 */
    type?: "user" | "agent";
    size?: number;
  }>(),
  { name: "", src: "", type: "user", size: 46 },
);

const DEFAULT_AVATAR: Record<"user" | "agent", string> = {
  user: "/default_user_avatar.png",
  agent: "/default_agent_avatar.png",
};

/** 图片加载失败（坏链接 / 离线）时回落到默认头像，避免出现破图。 */
const broken = ref(false);
watch(
  () => [props.src, props.type],
  () => {
    broken.value = false;
  },
);

const url = computed(() => {
  const raw = (props.src || "").trim();
  if (raw && !broken.value) return raw;
  return DEFAULT_AVATAR[props.type] ?? DEFAULT_AVATAR.user;
});

const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}));
</script>

<template>
  <div class="avatar" :style="style">
    <img
      :src="url"
      :alt="name || ''"
      :title="name || ''"
      loading="lazy"
      decoding="async"
      @error="broken = true"
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
