import { onMounted, onUnmounted } from "vue";

/**
 * Keep the app shell pinned to the *visual* viewport so the on-screen keyboard
 * never covers the message composer.
 *
 * Why this is needed: on many Android WebViews the soft keyboard does not
 * shrink `window.innerHeight` / `100vh` (and the `interactive-widget=resizes-content`
 * viewport hint is not always honoured). Only `window.visualViewport` shrinks.
 * We therefore mirror the visual viewport's height *and* its vertical offset
 * into `--app-height` / `--app-offset-top`; the fixed-positioned `.app-shell`
 * (see App.vue) consumes both values so it always fits exactly in the visible
 * area above the keyboard.
 *
 * A `keyboard-open` class is also toggled on <html> so the layout can react
 * (e.g. hide floating chrome) while the keyboard is visible.
 */
export function useVisualViewport() {
  let vv: VisualViewport | null = null;
  // A visual viewport materially shorter than the layout viewport means the
  // keyboard (or another inset) is covering the bottom of the screen.
  const KEYBOARD_THRESHOLD = 120;

  function apply() {
    const root = document.documentElement;
    const layoutHeight = window.innerHeight;
    if (vv) {
      const height = Math.round(vv.height);
      const offsetTop = Math.round(vv.offsetTop);
      root.style.setProperty("--app-height", `${height}px`);
      root.style.setProperty("--app-offset-top", `${offsetTop}px`);
      root.classList.toggle("keyboard-open", layoutHeight - height > KEYBOARD_THRESHOLD);
    } else {
      root.style.setProperty("--app-height", `${layoutHeight}px`);
      root.style.setProperty("--app-offset-top", "0px");
      root.classList.remove("keyboard-open");
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
