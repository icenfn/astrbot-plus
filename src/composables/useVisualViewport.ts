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
 *
 * IMPORTANT: we also lock `document.body` scrolling. When the keyboard opens,
 * some WebViews try to scroll the whole document to reveal the focused field,
 * which drags the fixed shell up and permanently offsets the composer — the
 * root cause behind the "input bar hidden behind the IME" bug. Locking the body
 * to the visual viewport keeps the shell glued in place.
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
      // `offsetTop` can briefly report a negative value during the keyboard
      // animation; clamp it so the shell never floats above the screen.
      const offsetTop = Math.max(0, Math.round(vv.offsetTop));
      root.style.setProperty("--app-height", `${height}px`);
      root.style.setProperty("--app-offset-top", `${offsetTop}px`);
      root.classList.toggle("keyboard-open", layoutHeight - height > KEYBOARD_THRESHOLD);
    } else {
      root.style.setProperty("--app-height", `${layoutHeight}px`);
      root.style.setProperty("--app-offset-top", "0px");
      root.classList.remove("keyboard-open");
    }
  }

  // Freeze any stray document scroll (the shell is position: fixed).
  function lockScroll() {
    if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
  }

  // Re-assert the layout a few times after focus changes: the keyboard animates
  // in over ~250ms and some WebViews only report the final size late.
  function reapplySoon() {
    apply();
    window.setTimeout(apply, 120);
    window.setTimeout(apply, 320);
  }

  onMounted(() => {
    vv = window.visualViewport ?? null;
    apply();
    if (vv) {
      vv.addEventListener("resize", apply);
      vv.addEventListener("scroll", apply);
    }
    // Always listen to the window too: on some Android WebViews the visual
    // viewport events fire late or not at all, so a plain window resize is a
    // useful fallback.
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    window.addEventListener("scroll", lockScroll, { passive: true });
    document.addEventListener("focusin", lockScroll);
    document.addEventListener("focusin", reapplySoon);
    document.addEventListener("focusout", reapplySoon);
  });

  onUnmounted(() => {
    if (vv) {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
    }
    window.removeEventListener("resize", apply);
    window.removeEventListener("orientationchange", apply);
    window.removeEventListener("scroll", lockScroll);
    document.removeEventListener("focusin", lockScroll);
    document.removeEventListener("focusin", reapplySoon);
    document.removeEventListener("focusout", reapplySoon);
  });
}
