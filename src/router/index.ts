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
      path: "/contacts",
      name: "contacts",
      component: () => import("@/views/ContactsView.vue"),
      meta: { title: "会话列表" },
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
