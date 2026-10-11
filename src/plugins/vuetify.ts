import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";

import { createVuetify, type ThemeDefinition } from "vuetify";
import { aliases, mdi } from "vuetify/iconsets/mdi";

/**
 * AstrBot+ theme — a faithful Telegram palette.
 * Dark theme mirrors Telegram Desktop dark (#0e1621 base, #17212b panels,
 * #2b5278 own-bubble, #5288c1 accent). Light theme mirrors Telegram's clean
 * white/green look (#ffffff panels, #eeffde own-bubble, #4fad5b accent).
 */

const telegramDark: ThemeDefinition = {
  dark: true,
  colors: {
    background: "#0e1621", // app background
    surface: "#17212b", // panels, headers, sidebar
    "surface-bright": "#1c2733", // hover / raised
    "surface-light": "#1e2c3a", // incoming bubble
    "surface-variant": "#232e3c", // inputs
    primary: "#5288c1", // Telegram accent blue
    "primary-darken-1": "#4a7aab",
    "own-bubble": "#2b5278", // own message bubble
    "on-own-bubble": "#ffffff",
    secondary: "#64b5f6",
    accent: "#4fc3f7",
    error: "#e53935",
    info: "#5288c1",
    success: "#4caf50",
    warning: "#fb8c00",
    "on-surface": "#e9edf1",
    "on-background": "#e9edf1",
  },
  variables: {
    "border-color": "#101921",
    "border-opacity": 0.6,
    "high-emphasis-opacity": 0.92,
    "medium-emphasis-opacity": 0.68,
    "hover-opacity": 0.06,
    "activated-opacity": 0.1,
  },
};

const telegramLight: ThemeDefinition = {
  dark: false,
  colors: {
    background: "#e7ebf0", // app background
    surface: "#ffffff", // panels, headers, sidebar
    "surface-bright": "#ffffff",
    "surface-light": "#f1f4f7", // incoming bubble
    "surface-variant": "#eef2f6", // inputs
    primary: "#4fad5b", // Telegram green accent
    "primary-darken-1": "#46a051",
    "own-bubble": "#eeffde", // own message bubble (light green)
    "on-own-bubble": "#1b2a17",
    secondary: "#1e88e5",
    accent: "#039be5",
    error: "#e53935",
    info: "#0288d1",
    success: "#43a047",
    warning: "#fb8c00",
    "on-surface": "#0f1b26",
    "on-background": "#0f1b26",
  },
  variables: {
    "border-color": "#d7dee5",
    "border-opacity": 0.8,
    "high-emphasis-opacity": 0.9,
    "medium-emphasis-opacity": 0.6,
    "hover-opacity": 0.05,
    "activated-opacity": 0.09,
  },
};

export default createVuetify({
  theme: {
    defaultTheme: "telegramDark",
    themes: {
      telegramDark,
      telegramLight,
    },
  },
  icons: {
    defaultSet: "mdi",
    aliases,
    sets: { mdi },
  },
  defaults: {
    VBtn: { rounded: "lg" },
    VTextField: { variant: "solo-filled", density: "comfortable", hideDetails: "auto" },
    VSelect: { variant: "solo-filled", density: "comfortable", hideDetails: "auto" },
    VCard: { rounded: "xl" },
    VList: { density: "comfortable" },
  },
});
