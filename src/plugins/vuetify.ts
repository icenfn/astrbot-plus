import "vuetify/styles";
import "@/styles/mdi.css";

import { createVuetify } from "vuetify";
import { aliases, mdi } from "vuetify/iconsets/mdi";
import { THEME_NAMES, themes } from "./theme";

/**
 * Vuetify 装配：只挂主题与图标，不使用 Global configuration（defaults）。
 * 组件外观由使用处显式声明，避免隐式全局默认值造成的样式不可预期。
 */
export default createVuetify({
  theme: {
    defaultTheme: THEME_NAMES.light,
    themes,
  },
  icons: {
    defaultSet: "mdi",
    aliases,
    sets: { mdi },
  },
});
