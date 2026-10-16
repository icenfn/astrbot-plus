import { createRouter, createWebHashHistory } from "vue-router";
import { useSettingsStore } from "@/stores/settings";

/**
 * Routing is organised around three PAGE FRAMES (vue-router layout routes),
 * instead of one global application bar hard-wired into `App.vue`:
 *
 *   • HomeLayout    — the 首页 frame. Its three primary tabs (消息 / 联系人 / 我的)
 *                     are EMBEDDED in the layout and switched locally (see
 *                     `useHomeTabs`), NOT routed: keeping them mounted preserves
 *                     each page's scroll position/state, removes the route-switch
 *                     flicker, and gives the three panes one shared background.
 *   • MessageLayout — the 消息页面 frame for a single open conversation.
 *   • BackLayout    — the generic 带返回按钮 frame for secondary pages.
 *
 * The 向导 page (`/wizard`) is a standalone full-screen frame of its own.
 *
 * Every frame renders the chrome it needs and delegates its content to a
 * nested `<router-view/>`, so pages stay free of shell concerns.
 */
const router = createRouter({
  // Hash history works reliably inside the Tauri webview.
  history: createWebHashHistory(),
  routes: [
    {
      // 首页框架. The 消息 / 联系人 / 我的 panes are EMBEDDED in HomeLayout and
      // switched locally via `useHomeTabs` — they are deliberately NOT child
      // routes, so they stay mounted and share one background. The route keeps the
      // name `chats` as the identity of the home frame (used by the back handler).
      path: "/",
      name: "chats",
      component: () => import("@/layouts/HomeLayout.vue"),
      meta: { title: "消息" },
    },
    {
      // 配置向导 — standalone full-screen page. Entered automatically while no
      // plugin address is configured, and re-entered from 设置 → 连接 →「重新配置」.
      path: "/wizard",
      name: "wizard",
      component: () => import("@/views/WizardView.vue"),
      meta: { title: "配置 AstrBot+" },
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

/**
 * First-run gate: without a configured plugin address the app has nothing to do,
 * so every navigation is redirected into the 向导 page. The guard never redirects
 * AWAY from the wizard, so 「重新配置」 (which is reachable while configured) is
 * always allowed.
 */
router.beforeEach((to) => {
  if (to.name === "wizard") return true;
  const settings = useSettingsStore();
  if (!settings.hasCredentials) return { name: "wizard" };
  return true;
});

export default router;
