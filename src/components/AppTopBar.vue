<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

// A single, app-wide application bar. The page title is derived from the
// current route's meta, so individual pages no longer render their own header
// text (the old「消息」/「设置」in-page titles are gone). A back button appears
// on non-root pages (e.g. 设置) so they can be dismissed on any platform.
const route = useRoute();
const router = useRouter();

const ROOTS = ["chats", "contacts", "mine"];
const title = computed(() => (route.meta.title as string | undefined) ?? "AstrBot+");
const showBack = computed(() => !ROOTS.includes(String(route.name)));
</script>

<template>
  <v-toolbar class="app-topbar" density="comfortable" flat>
    <v-btn
      v-if="showBack"
      icon="mdi-arrow-left"
      variant="text"
      :ripple="false"
      class="mr-1"
      title="返回"
      @click="router.back()"
    />
    <v-toolbar-title class="app-topbar-title">{{ title }}</v-toolbar-title>
  </v-toolbar>
</template>

<style scoped>
.app-topbar {
  flex: 0 0 auto;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  padding-top: env(safe-area-inset-top, 0px);
}
.app-topbar-title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0;
}
</style>
