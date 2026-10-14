<script setup lang="ts">
import { usePlatform } from "@/composables/usePlatform";
import AppTopBar from "@/components/AppTopBar.vue";
import AppSidebar from "@/components/AppSidebar.vue";
import AppMobileNav from "@/components/AppMobileNav.vue";

/**
 * HomeLayout — the app 首页 (home) frame.
 *
 * This is the vue-router layout for the three primary tabs (消息 / 联系人 / 我的):
 * an application bar whose title comes from the active child route's
 * `meta.title`, a desktop side rail, the routed page, and — on mobile — the
 * bottom tab bar. The application bar is no longer hard-wired into `App.vue`;
 * each frame owns the chrome appropriate to its pages.
 */
const { isMobile } = usePlatform();
</script>

<template>
  <div class="home-layout">
    <AppTopBar />
    <div class="home-body">
      <AppSidebar v-if="!isMobile" />
      <div class="home-view">
        <router-view />
      </div>
    </div>
    <AppMobileNav v-if="isMobile" />
  </div>
</template>

<style scoped>
.home-layout {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.home-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}
.home-view {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
</style>
