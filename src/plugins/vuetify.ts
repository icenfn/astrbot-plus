import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";

import { createVuetify, type ThemeDefinition } from "vuetify";
import { aliases, mdi } from "vuetify/iconsets/mdi";

/**
 * AstrBot+ theme — a clean blue palette (both dark & light use a blue accent).
 * Dark: deep navy surfaces with a vivid blue accent. Light: bright airy panels
 * with the same blue accent.
 */

const telegramDark: ThemeDefinition = {
  dark: true,
  colors: {
    background: "#0d1526", // app background (deep navy)
    surface: "#151f33", // panels, headers, sidebar
    "surface-bright": "#1a2740", // hover / raised
    "surface-light": "#1d2a45", // incoming bubble
    "surface-variant": "#22314f", // inputs
    primary: "#4f8ff0", // blue accent
    "primary-darken-1": "#3f7ce0",
    "own-bubble": "#2456a8", // own message bubble (blue)
    "on-own-bubble": "#ffffff",
    secondary: "#6aa6ff",
    accent: "#4fc3f7",
    error: "#e53935",
    info: "#4f8ff0",
    success: "#4caf50",
    warning: "#fb8c00",
    "on-surface": "#e9edf3",
    "on-background": "#e9edf3",
  },
  variables: {
    "border-color": "#101a2e",
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
    background: "#eef3fb", // app background (soft blue-grey)
    surface: "#ffffff", // panels, headers, sidebar
    "surface-bright": "#ffffff",
    "surface-light": "#eef2f9", // incoming bubble
    "surface-variant": "#e7edf7", // inputs
    primary: "#2f80ed", // blue accent
    "primary-darken-1": "#2673d6",
    "own-bubble": "#d9e8ff", // own message bubble (light blue)
    "on-own-bubble": "#0e2a4a",
    secondary: "#2f80ed",
    accent: "#1e88e5",
    error: "#e53935",
    info: "#2f80ed",
    success: "#43a047",
    warning: "#fb8c00",
    "on-surface": "#0f1b26",
    "on-background": "#0f1b26",
  },
  variables: {
    "border-color": "#d3dce9",
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
