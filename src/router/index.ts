import { createRouter, createWebHashHistory } from "vue-router";

const router = createRouter({
  // Hash history works reliably inside the Tauri webview.
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      name: "chats",
      component: () => import("@/views/ChatView.vue"),
      meta: { title: "聊天" },
    },
    {
      // A single open conversation. Routing the open Agent (instead of only
      // holding it in store state) gives the mobile / Android hardware back
      // button a real history target, so leaving a conversation and returning
      // to the list — the chats 首页 — always works.
      path: "/chat/:id",
      name: "chat",
      component: () => import("@/views/ChatView.vue"),
      meta: { title: "聊天" },
    },
    {
      path: "/settings",
      name: "settings",
      component: () => import("@/views/SettingsView.vue"),
      meta: { title: "设置" },
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

export default router;
