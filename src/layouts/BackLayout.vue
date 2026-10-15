<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

/**
 * BackLayout — the generic 带返回按钮 page frame.
 *
 * Any secondary page (设置, 关于, …) that is not one of the primary tabs is
 * nested under this layout: an application bar carrying the route's
 * `meta.title` plus a back button that always dismisses the page. Keeping the
 * back affordance in the LAYOUT (rather than per page) means every page pushed
 * on top of the tabs behaves identically.
 */
const route = useRoute();
const router = useRouter();

const title = computed(() => (route.meta.title as string | undefined) ?? "AstrBot+");

function goBack(): void {
  // Prefer real history so the Android hardware back stack stays in sync; fall
  // back to the home tab when the page was opened directly (e.g. deep link).
  if (window.history.length > 1) router.back();
  else void router.push("/");
}
</script>

<template>
  <div class="back-layout">
    <v-toolbar class="back-topbar" density="comfortable" flat>
      <v-btn
        icon="mdi-arrow-left"
        variant="text"
        :ripple="false"
        class="mr-1"
        title="返回"
        @click="goBack"
      />
      <v-toolbar-title class="back-title">{{ title }}</v-toolbar-title>
    </v-toolbar>
    <div class="back-body">
      <router-view />
    </div>
  </div>
</template>

<style scoped>
.back-layout {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.back-topbar {
  flex: 0 0 auto;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
}
.back-title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0;
}
.back-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
</style>
