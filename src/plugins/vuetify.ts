import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";

import { createVuetify, type ThemeDefinition } from "vuetify";
import { aliases, mdi } from "vuetify/iconsets/mdi";

/**
 * AstrBot+ theme — a Telegram-inspired palette.
 * The primary color is derived from the AstrBot brand color (#2f86bd).
 */
const astrbotDark: ThemeDefinition = {
  dark: true,
  colors: {
    background: "#0e1621",
    surface: "#17212b",
    "surface-bright": "#1d2836",
    "surface-light": "#202b36",
    "surface-variant": "#232e3c",
    primary: "#2f86bd",
    "primary-darken-1": "#2b79ab",
    secondary: "#64b5f6",
    accent: "#4fc3f7",
    error: "#e53935",
    info: "#29b6f6",
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
  },
};

const astrbotLight: ThemeDefinition = {
  dark: false,
  colors: {
    background: "#f4f6f8",
    surface: "#ffffff",
    "surface-bright": "#ffffff",
    "surface-light": "#ffffff",
    "surface-variant": "#eef2f6",
    primary: "#2f86bd",
    "primary-darken-1": "#2b79ab",
    secondary: "#1e88e5",
    accent: "#039be5",
    error: "#e53935",
    info: "#0288d1",
    success: "#43a047",
    warning: "#fb8c00",
    "on-surface": "#0f1b26",
    "on-background": "#0f1b26",
  },
};

export default createVuetify({
  theme: {
    defaultTheme: "astrbotDark",
    themes: {
      astrbotDark,
      astrbotLight,
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
