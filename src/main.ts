import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import vuetify from "./plugins/vuetify";
import "./styles/main.scss";

// --- Mobile: disable pinch-to-zoom ---------------------------------------
// The viewport meta (user-scalable=no + maximum-scale=1) covers most cases;
// these guards keep the WebView from zooming even when the OS "force zoom"
// accessibility option is on.
for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
  document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
}
document.addEventListener(
  "touchmove",
  (event) => {
    // A multi-finger touch is a pinch gesture: block it.
    if (event.touches.length > 1) event.preventDefault();
  },
  { passive: false },
);
window.addEventListener(
  "wheel",
  (event) => {
    // Trackpad/ctrl-wheel zoom.
    if (event.ctrlKey) event.preventDefault();
  },
  { passive: false },
);

// --- Native safe-area bridge ---------------------------------------------
// The Android shell (MainActivity) draws edge-to-edge and forwards the single
// set of system-bar / cutout insets here as CSS variables, so app chrome pads
// for them exactly once. The CSS falls back to env() on other platforms.
declare global {
  interface Window {
    __astrbotApplyInsets?: (top: number, bottom: number, left: number, right: number) => void;
  }
}
window.__astrbotApplyInsets = (top, bottom, left, right) => {
  const s = document.documentElement.style;
  s.setProperty("--safe-area-inset-top", `${top}px`);
  s.setProperty("--safe-area-inset-bottom", `${bottom}px`);
  s.setProperty("--safe-area-inset-left", `${left}px`);
  s.setProperty("--safe-area-inset-right", `${right}px`);
};

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(vuetify);

app.mount("#app");
