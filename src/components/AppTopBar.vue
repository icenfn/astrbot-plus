<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

/**
 * AppTopBar — a title-only application bar.
 *
 * The title is derived from the active route's `meta.title`. The back button now
 * belongs to `BackLayout`, so this bar only needs to render the title for the
 * home and message frames.
 */
const route = useRoute();

const title = computed(() => (route.meta.title as string | undefined) ?? "AstrBot+");
</script>

<template>
  <v-toolbar class="app-topbar" density="comfortable" flat>
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
