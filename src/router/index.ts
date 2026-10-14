import { createRouter, createWebHashHistory } from "vue-router";

const router = createRouter({
  // Hash history works reliably inside the Tauri webview.
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      name: "chats",
      component: () => import("@/views/ChatView.vue"),
      meta: { title: "消息" },
    },
    {
      // A single open conversation. Routing the open Agent (instead of only
      // holding it in store state) gives the mobile / Android hardware back
      // button a real history target, so leaving a conversation and returning
      // to the list always works.
      path: "/chat/:id",
      name: "chat",
      component: () => import("@/views/ChatView.vue"),
      meta: { title: "消息" },
    },
    {
      path: "/contacts",
      name: "contacts",
      component: () => import("@/views/ContactsView.vue"),
      meta: { title: "联系人" },
    },
    {
      path: "/mine",
      name: "mine",
      component: () => import("@/views/MineView.vue"),
      meta: { title: "我的" },
    },
    {
      // Settings is a standalone route (no longer a home tab); it is reached
      // from the「我的」page.
      path: "/settings",
      name: "settings",
      component: () => import("@/views/SettingsView.vue"),
      meta: { title: "设置" },
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

export default router;
