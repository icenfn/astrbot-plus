import type { ThemeDefinition } from "vuetify";

/**
 * AstrBot+ 主题体系 —— 全项目**唯一**的配色来源。
 *
 * 为什么单独抽这个文件：
 *   1. 原来亮/暗两套色板、组件 defaults 都塞在 `vuetify.ts` 里，改一个颜色要
 *      在几百行里翻找；抽出来之后 `vuetify.ts` 只负责「怎么装」，这里只负责
 *      「长什么样」，两者职责分离。
 *   2. 主题名同样集中导出（`THEME_NAMES`），业务代码不再手写字符串
 *      `"telegramDark"` 之类，改名时只有一处需要动。
 *
 * 配色设计（暗色为重点优化项）：
 *   • 暗色不再是「background == surface」的一片糊，而是三层景深：
 *       background(最深) → surface(面板) → surface-bright(悬浮/抬升)
 *     列表、卡片与页面底色之间有了明确的层次，长时间阅读不累眼。
 *   • primary 提亮到 #5b9dff：蓝色在深色背景上对比更高（对 #151f33 约 4.6:1），
 *     同时 `on-primary` 用深蓝而非纯白，让主色按钮上的文字不至于「发光」。
 *   • 语义色（error/success/warning/info）统一按 Material 调色板取值，避免
 *     不同页面出现「同一含义、不同红绿」的碎片化。
 *   • 亮色保持清爽白底，但页面底色略压到 #f5f8fd，面板仍是纯白，形成「白卡片
 *     浮在浅灰蓝底上」的层次，而不是全局死白。
 *
 * 兼容性说明：这里只产出 CSS 自定义属性（`--v-theme-*`），不依赖任何现代 CSS
 * 语法，因此新旧 WebView 都能正确取色；老浏览器的 CSS 降级由构建期 PostCSS
 * 负责（见 postcss.config.js），二者互不干扰。
 */

/** 主题名常量 —— 业务代码引用这里，不要手写字符串。 */
export const THEME_NAMES = {
  dark: "astrbotDark",
  light: "astrbotLight",
} as const;

export type ThemeName = (typeof THEME_NAMES)[keyof typeof THEME_NAMES];

/** 暗色主题：深海军蓝三层景深 + 高对比蓝色主色。 */
export const darkTheme: ThemeDefinition = {
  dark: true,
  colors: {
    background: "#0d1526", // 页面底色（最深）
    surface: "#151f33", // 面板 / 顶栏 / 列表底
    "surface-bright": "#1c2a45", // 悬浮、抬升状态
    "surface-light": "#1a2740", // 对方气泡
    "surface-variant": "#22314f", // 输入框 / 次级容器
    primary: "#5b9dff", // 蓝色主色（深底上对比约 4.6:1）
    "primary-darken-1": "#4a8bf0",
    "on-primary": "#06182f", // 主色之上的文字：深蓝，避免「白字发光」
    secondary: "#8fb8ff",
    accent: "#4dd0e1",
    error: "#ef5350",
    info: "#5b9dff",
    success: "#4caf50",
    warning: "#ffa726",
    "own-bubble": "#2b5ea8", // 自己发出的气泡
    "on-own-bubble": "#ffffff",
    "on-surface": "#e8eefb",
    "on-background": "#e8eefb",
  },
  variables: {
    "border-color": "#0a1322",
    "border-opacity": 0.6,
    "high-emphasis-opacity": 0.92,
    "medium-emphasis-opacity": 0.68,
    "disabled-opacity": 0.42,
    "hover-opacity": 0.06,
    "activated-opacity": 0.1,
    // 海拔/悬浮叠加色：必须是 `#rrggbb`，Vuetify 才会序列化成 `r, g, b` 三元组，
    // 构建期 color-mix() 降级才能写出 `rgba(var(--v-elevation-overlay-color), α)`。
    "elevation-overlay-color": "#FFFFFF",
  },
};

/** 亮色主题：白卡片 + 浅灰蓝页面底 + 同一个蓝色主色。 */
export const lightTheme: ThemeDefinition = {
  dark: false,
  colors: {
    background: "#f5f8fd",
    surface: "#ffffff",
    "surface-bright": "#ffffff",
    "surface-light": "#eef3fb",
    "surface-variant": "#e6edf8",
    primary: "#1a73e8",
    "primary-darken-1": "#1666cf",
    "on-primary": "#ffffff",
    secondary: "#4285f4",
    accent: "#0288d1",
    error: "#d93025",
    info: "#1a73e8",
    success: "#188038",
    warning: "#e8710a",
    "own-bubble": "#d7e7ff",
    "on-own-bubble": "#0b2b52",
    "on-surface": "#121a24",
    "on-background": "#121a24",
  },
  variables: {
    "border-color": "#d3dce9",
    "border-opacity": 0.8,
    "high-emphasis-opacity": 0.9,
    "medium-emphasis-opacity": 0.6,
    "disabled-opacity": 0.38,
    "hover-opacity": 0.05,
    "activated-opacity": 0.09,
    "elevation-overlay-color": "#000000",
  },
};

export const themes = {
  [THEME_NAMES.dark]: darkTheme,
  [THEME_NAMES.light]: lightTheme,
};
