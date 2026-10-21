import "vuetify/styles";
// woff2-only MDI icon font (see src/styles/mdi.css) — trims ~3.2 MB of
// eot/ttf/woff variants that WebView 91+ never downloads.
import "@/styles/mdi.css";

import { createVuetify } from "vuetify";
import { aliases, mdi } from "vuetify/iconsets/mdi";
import { THEME_NAMES, themes } from "./theme";

/**
 * Vuetify 装配入口 —— 只负责「怎么装」，不负责「长什么样」。
 *
 * 分工：
 *   • 配色 / 主题定义 → `./theme.ts`（唯一配色来源）
 *   • 组件默认 props  → 下方 `defaults`（Vuetify Global configuration 特性）
 *
 * 关于「v-chip / v-switch / v-btn 不跟随主题色」的真实根因（重要）：
 *   不是 primary 没设成蓝色（它一直是蓝色），也不是 polyfills/PostCSS 把颜色弄丢。
 *   Vuetify 4 把样式放进 CSS 级联层（`@layer`）：
 *     - 静态组件样式（VBtn.css 等）在构建期被 PostCSS 展平成**无层级**规则；
 *     - 运行时注入的主题工具类（`.bg-primary` 等）仍留在 `@layer vuetify-utilities` 内。
 *   CSS 规范规定：**未分层的规则优先于一切分层规则**。于是
 *   `.v-btn--variant-flat { background: rgb(var(--v-theme-surface)) }` 永远压过
 *   `.bg-primary`，chip/switch/button 看起来就「不跟主题色」。
 *   修复在 `src/compat/legacy-css.ts`：把运行时主题表也去层并置于 <head> 末尾，
 *   恢复 Vuetify 原本「utilities 最后」的层序语义，新旧 WebView 表现一致。
 *
 * 关于 polyfills / PostCSS（保留，不删）：
 *   它们服务于 Vuetify 4 的浏览器支持基线（Chrome 107+ / Safari 16+）以下的
 *   WebView。core-js 的 polyfill 是**运行期特性探测**后才打的，现代浏览器不会
 *   执行；PostCSS 的降级（dvh 兜底、color-mix 展开）保留原生值，现代浏览器仍走
 *   原生分支。唯一无法「只影响老浏览器」的是 `@layer` 展平 —— 单产物构建下
 *   必然作用全局，所以才用上面的运行时一致性方案兜住。
 */
export default createVuetify({
  // ── 主题（Vuetify Theme 特性）──────────────────────────────────────────────
  theme: {
    defaultTheme: THEME_NAMES.dark,
    themes,
  },

  // ── 图标 ──────────────────────────────────────────────────────────────────
  icons: {
    defaultSet: "mdi",
    aliases,
    sets: { mdi },
  },

  // ── 组件默认 props（Vuetify Global configuration 特性）────────────────────
  // 所有「统一行为」都在这里声明，页面里不再逐个重复写 color / rounded /
  // density 之类的值。新增页面时天然继承，改一次全局生效。
  defaults: {
    global: {
      // 移动端优先：全局紧凑但不拥挤，桌面端由各处 density 覆盖。
      ripple: true,
    },

    // 主题色跟随：这三个组件是「不跟主题色」问题的当事组件，统一在这里声明
    // color，保证任何页面的实例都取主题主色，而不是各自忘记传 color。
    VBtn: { rounded: "lg", color: "primary" },
    VSwitch: {
      color: "primary",
      density: "compact",
      hideDetails: "auto",
      // 药丸式开关（Material 3）：轨道贴合滑块，替掉老式方角样式。
      inset: true,
    },
    VChip: { color: "primary", rounded: "lg" },

    // 表单类：统一的 solo-filled 外观 + 隐藏 details，避免行高抖动。
    VTextField: {
      variant: "solo-filled",
      density: "comfortable",
      hideDetails: "auto",
    },
    VSelect: {
      variant: "solo-filled",
      density: "comfortable",
      hideDetails: "auto",
      // 窄屏防挤压的关键：菜单宽度跟随触发器，且不撑破父容器。
      menuProps: { maxWidth: 320 },
    },
    VTextarea: {
      variant: "solo-filled",
      density: "comfortable",
      hideDetails: "auto",
    },

    VCard: { rounded: "xl" },
    VList: { density: "comfortable" },
    VListItem: { rounded: "lg" },
    VDialog: { maxWidth: 420 },
    VSnackbar: { rounded: "lg" },
    VTooltip: { location: "top" },
  },
});
