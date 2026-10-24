import type { ThemeDefinition } from "vuetify";

/**
 * 项目唯一配色来源：浅色 / 深色两套 Material 主题。
 *
 * 只产出 Vuetify 主题变量（--v-theme-*），不含任何全局组件默认值，
 * 组件外观一律由使用处显式声明。
 */

export const THEME_NAMES = {
  light: "astrbotLight",
  dark: "astrbotDark",
} as const;

export type ThemeName = (typeof THEME_NAMES)[keyof typeof THEME_NAMES];

/** 深色：三层景深（background → surface → surface-bright）。 */
export const darkTheme: ThemeDefinition = {
  dark: true,
  colors: {
    background: "#0f1721",
    surface: "#161f2b",
    "surface-bright": "#1f2a38",
    "surface-light": "#1b2531",
    "surface-variant": "#25313f",
    "on-surface": "#e6ecf4",
    "on-background": "#e6ecf4",
    primary: "#4c9aff",
    "primary-darken-1": "#3d86e6",
    "on-primary": "#06131f",
    secondary: "#8ab4f8",
    accent: "#39d0d8",
    error: "#f0655f",
    info: "#4c9aff",
    success: "#46b96b",
    warning: "#f5a623",
    "own-bubble": "#1f4d8f",
    "on-own-bubble": "#ffffff",
  },
  variables: {
    "border-color": "#0a1119",
    "border-opacity": 0.7,
    "high-emphasis-opacity": 0.92,
    "medium-emphasis-opacity": 0.66,
    "disabled-opacity": 0.4,
    "hover-opacity": 0.06,
    "activated-opacity": 0.1,
    "elevation-overlay-color": "#FFFFFF",
  },
};

/** 浅色：白面板浮在浅灰蓝底上。 */
export const lightTheme: ThemeDefinition = {
  dark: false,
  colors: {
    background: "#f2f5f9",
    surface: "#ffffff",
    "surface-bright": "#ffffff",
    "surface-light": "#eaf0f7",
    "surface-variant": "#e3eaf3",
    "on-surface": "#101a24",
    "on-background": "#101a24",
    primary: "#1a73e8",
    "primary-darken-1": "#1665cd",
    "on-primary": "#ffffff",
    secondary: "#4285f4",
    accent: "#0288d1",
    error: "#d93a32",
    info: "#1a73e8",
    success: "#1a8449",
    warning: "#e07b00",
    "own-bubble": "#d6e6ff",
    "on-own-bubble": "#0a2a4f",
  },
  variables: {
    "border-color": "#ccd7e5",
    "border-opacity": 0.85,
    "high-emphasis-opacity": 0.9,
    "medium-emphasis-opacity": 0.6,
    "disabled-opacity": 0.38,
    "hover-opacity": 0.05,
    "activated-opacity": 0.09,
    "elevation-overlay-color": "#000000",
  },
};

export const themes = {
  [THEME_NAMES.light]: lightTheme,
  [THEME_NAMES.dark]: darkTheme,
};
