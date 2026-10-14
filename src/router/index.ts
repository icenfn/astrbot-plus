import { createRouter, createWebHashHistory } from "vue-router";

/**
 * Routing is organised around three PAGE FRAMES (vue-router layout routes),
 * instead of one global application bar hard-wired into `App.vue`:
 *
 *   • HomeLayout    — the 首页 frame for the three primary tabs.
 *   • MessageLayout — the 消息页面 frame for a single open conversation.
 *   • BackLayout    — the generic 带返回按钮 frame for secondary pages.
 *
 * Every frame renders the chrome it needs and delegates its content to a
 * nested `<router-view/>`, so pages stay free of shell concerns.
 */
const router = createRouter({
  // Hash history works reliably inside the Tauri webview.
  history: createWebHashHistory(),
  routes: [
    {
      // 首页框架 — the primary tabbed shell (消息 / 联系人 / 我的).
      path: "/",
      component: () => import("@/layouts/HomeLayout.vue"),
      children: [
        {
          path: "",
          name: "chats",
          component: () => import("@/views/ChatsView.vue"),
          meta: { title: "消息" },
        },
        {
          path: "contacts",
          name: "contacts",
          component: () => import("@/views/ContactsView.vue"),
          meta: { title: "联系人" },
        },
        {
          path: "mine",
          name: "mine",
          component: () => import("@/views/MineView.vue"),
          meta: { title: "我的" },
        },
      ],
    },
    {
      // 消息页面框架 — one open conversation. Routing the open Agent (instead of
      // only holding it in store state) gives the mobile / Android hardware back
      // button a real history target.
      path: "/chat/:id",
      component: () => import("@/layouts/MessageLayout.vue"),
      children: [
        {
          path: "",
          name: "chat",
          component: () => import("@/views/ChatSessionView.vue"),
          meta: { title: "消息" },
        },
      ],
    },
    {
      // 带返回按钮通用页面框架 — reached from the「我的」page.
      path: "/settings",
      component: () => import("@/layouts/BackLayout.vue"),
      children: [
        {
          path: "",
          name: "settings",
          component: () => import("@/views/SettingsView.vue"),
          meta: { title: "设置" },
        },
      ],
    },
    {
      path: "/about",
      component: () => import("@/layouts/BackLayout.vue"),
      children: [
        {
          path: "",
          name: "about",
          component: () => import("@/views/AboutView.vue"),
          meta: { title: "关于" },
        },
      ],
    },
    {
      // Agent 信息 (bot_id + partial config) — opened from the message page's
      // application-bar info button. Uses the generic 带返回按钮 frame.
      path: "/agent/:id",
      component: () => import("@/layouts/BackLayout.vue"),
      children: [
        {
          path: "",
          name: "agent-info",
          component: () => import("@/views/AgentInfoView.vue"),
          meta: { title: "Agent 信息" },
        },
      ],
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

export default router;
