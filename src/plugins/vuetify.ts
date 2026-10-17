import "vuetify/styles";
// woff2-only MDI icon font (see src/styles/mdi.css) — trims ~3.2 MB of
// eot/ttf/woff variants that WebView 91+ never downloads.
import "@/styles/mdi.css";

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
    background: "#151f33", // app background — unified with surface (majority page colour)
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
    // Overlay colour used by Vuetify's elevation / hover mixes. A `#rrggbb`
    // value makes Vuetify serialise it to an `r, g, b` triplet, which lets the
    // build-time color-mix() fallback emit
    // `rgba(var(--v-elevation-overlay-color), α)` for old WebViews (a keyword
    // like `white`/`black` would not resolve inside `rgba()`).
    "elevation-overlay-color": "#FFFFFF",
  },
};

const telegramLight: ThemeDefinition = {
  dark: false,
  colors: {
    background: "#ffffff", // app background — unified with surface (majority page colour)
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
    // Light theme overlays darken (see the dark theme note above).
    "elevation-overlay-color": "#000000",
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
    /**
     * Theme-colour defaults (the "chip / switch / button ignore the accent colour" bug).
     *
     * Root cause: these components had NO `color`, so Vuetify fell back to neutral
     * surface/on-surface tones. It was NOT the PostCSS/legacy pipeline — that layer
     * only down-levels modern CSS so Vuetify 4 still renders on Android WebView ≥90,
     * and it is kept intact. Setting the accent explicitly here (single source of
     * truth) is what makes every instance follow the theme, without repeating
     * color="primary" in dozens of call sites.
     */
    VBtn: { rounded: "lg", color: "primary" },
    VSwitch: {
      color: "primary",
      density: "compact",
      hideDetails: "auto",
      // Pill-style switch (Material 3): track hugs the thumb instead of the old
      // squared-off look, on every switch in the app.
      inset: true,
    },
    VChip: { color: "primary" },
    VTextField: { variant: "solo-filled", density: "comfortable", hideDetails: "auto" },
    VSelect: { variant: "solo-filled", density: "comfortable", hideDetails: "auto" },
    VCard: { rounded: "xl" },
    VList: { density: "comfortable" },
  },
});
