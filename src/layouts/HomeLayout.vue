<script setup lang="ts">
import { usePlatform } from "@/composables/usePlatform";
import { useHomeTabs } from "@/composables/useHomeTabs";
import AppTopBar from "@/components/AppTopBar.vue";
import AppSidebar from "@/components/AppSidebar.vue";
import AppMobileNav from "@/components/AppMobileNav.vue";
import ChatsView from "@/views/ChatsView.vue";
import ContactsView from "@/views/ContactsView.vue";
import MineView from "@/views/MineView.vue";

/**
 * HomeLayout — the app 首页 (home) frame.
 *
 * The three primary pages (消息 / 联系人 / 我的) are EMBEDDED here and switched with
 * `v-show` (driven by `useHomeTabs`) instead of vue-router. This keeps each page
 * mounted, preserves its scroll position/state, removes the route-switch flicker,
 * and lets the three panes share one background — the reported colour mismatch
 * between the three pages. The bottom tab bar / desktop rail toggle the pane; the
 * application bar reads its title from the active pane.
 */
const { isMobile } = usePlatform();
const { activeHomeTab } = useHomeTabs();
</script>

<template>
  <div class="home-layout">
    <AppTopBar />
    <div class="home-body">
      <AppSidebar v-if="!isMobile" />
      <div class="home-view">
        <ChatsView v-show="activeHomeTab === 'chats'" />
        <ContactsView v-show="activeHomeTab === 'contacts'" />
        <MineView v-show="activeHomeTab === 'mine'" />
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
  /* One shared surface colour for all three panes (matches the 消息 list page). */
  background: rgb(var(--v-theme-surface));
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
/* Embedded panes (they no longer get sized by <router-view/>). */
.home-view > * {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}
</style>
