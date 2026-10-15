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

// --- Native safe-area + keyboard bridge ----------------------------------
// The Android shell (MainActivity) draws edge-to-edge and forwards the single
// set of system-bar / cutout insets AND the on-screen keyboard (IME) height here
// as CSS variables, so app chrome pads for the safe area exactly once and the
// message composer can lift above the keyboard. The CSS falls back to env() on
// platforms without this bridge.
declare global {
  interface Window {
    __astrbotApplyInsets?: (
      top: number,
      bottom: number,
      left: number,
      right: number,
      keyboard?: number,
    ) => void;
  }
}
window.__astrbotApplyInsets = (top, bottom, left, right, keyboard = 0) => {
  const s = document.documentElement.style;
  s.setProperty("--safe-area-inset-top", `${top}px`);
  s.setProperty("--safe-area-inset-bottom", `${bottom}px`);
  s.setProperty("--safe-area-inset-left", `${left}px`);
  s.setProperty("--safe-area-inset-right", `${right}px`);
  // On-screen keyboard (IME) height — consumed by useVisualViewport() to shrink
  // the shell so the composer sits directly above the keyboard on edge-to-edge
  // Android, where the WebView is not resized for the keyboard.
  s.setProperty("--keyboard-height", `${keyboard}px`);
  // Let the shell and the message page react immediately (recompute height,
  // re-pin the message list to the bottom).
  window.dispatchEvent(new CustomEvent("astrbot:viewport"));
};

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(vuetify);

app.mount("#app");
