import { onMounted, onUnmounted } from "vue";

/**
 * Keep the app shell sized to the *visual* viewport so the on-screen keyboard
 * never covers the message composer.
 *
 * When the soft keyboard opens, `window.innerHeight` / `100vh` do NOT shrink on
 * many mobile WebViews, but `window.visualViewport.height` does. We mirror that
 * value into the `--app-height` CSS variable and the shell uses it, so the
 * composer stays pinned just above the keyboard.
 */
export function useVisualViewport() {
  let vv: VisualViewport | null = null;

  function apply() {
    const root = document.documentElement;
    if (vv) {
      root.style.setProperty("--app-height", `${Math.round(vv.height)}px`);
      root.style.setProperty("--app-offset-top", `${Math.round(vv.offsetTop)}px`);
    } else {
      root.style.setProperty("--app-height", `${window.innerHeight}px`);
      root.style.setProperty("--app-offset-top", "0px");
    }
  }

  onMounted(() => {
    vv = window.visualViewport ?? null;
    apply();
    if (vv) {
      vv.addEventListener("resize", apply);
      vv.addEventListener("scroll", apply);
    } else {
      window.addEventListener("resize", apply);
    }
    window.addEventListener("orientationchange", apply);
  });

  onUnmounted(() => {
    if (vv) {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
    } else {
      window.removeEventListener("resize", apply);
    }
    window.removeEventListener("orientationchange", apply);
  });
}
