import { onMounted, onUnmounted } from "vue";

/**
 * Keep the app shell pinned to the *visual* viewport so the on-screen keyboard
 * never covers the message composer.
 *
 * Two independent signals feed the shell height:
 *
 *   1. `window.visualViewport` — the browser's own idea of the visible area. On
 *      some Android WebViews the IME does not shrink it at all, which is why the
 *      composer used to end up behind the keyboard.
 *   2. `--keyboard-height` — the IME height reported *natively* by the Android
 *      shell (MainActivity) in CSS px. This is the authoritative value when the
 *      WebView (edge-to-edge) does not resize itself for the keyboard.
 *
 * To stay correct whichever signal fires, we remember the tallest layout height
 * seen while the keyboard is closed as a baseline, then:
 *
 *     desired = baseline - keyboardHeight
 *     height  = min(visualViewport.height, desired)
 *
 * If the browser already shrank the visual viewport for the keyboard, the two
 * values agree (no double subtraction); if it did not, `desired` clamps the
 * shell so the composer still clears the keyboard.
 *
 * `--app-height` / `--app-offset-top` are consumed by the fixed `.app-shell`
 * (App.vue). A `keyboard-open` class is toggled on <html> so layouts can react
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
  // Tallest layout viewport observed while the keyboard is closed.
  let baseline = window.innerHeight;
  // A visual viewport / native IME materially shorter than the baseline means
  // the keyboard (or another inset) is covering the bottom of the screen.
  const KEYBOARD_THRESHOLD = 8;

  /** Native IME height in CSS px (0 when unavailable / keyboard closed). */
  function keyboardHeight(): number {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--keyboard-height");
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) && n > KEYBOARD_THRESHOLD ? n : 0;
  }

  function apply() {
    const root = document.documentElement;
    const kb = keyboardHeight();
    const innerH = window.innerHeight;
    // Only trust the current innerHeight as the baseline when no keyboard is up.
    if (kb === 0) baseline = Math.max(baseline, innerH);

    const vvH = vv ? vv.height : innerH;
    const desired = Math.max(0, baseline - kb);
    const height =
      kb > 0 ? Math.max(0, Math.round(Math.min(vvH, desired))) : Math.max(0, Math.round(vvH));
    // `offsetTop` can briefly report a negative value during the keyboard
    // animation; clamp it so the shell never floats above the screen.
    const offsetTop = Math.max(0, Math.round(vv ? vv.offsetTop : 0));

    root.style.setProperty("--app-height", `${height}px`);
    root.style.setProperty("--app-offset-top", `${offsetTop}px`);
    // The keyboard is considered open when the native IME reports height OR the
    // visual viewport is materially shorter than the keyboard-closed baseline.
    root.classList.toggle("keyboard-open", kb > 0 || baseline - vvH > KEYBOARD_THRESHOLD);
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

  function onOrientationChange() {
    // innerHeight changes with orientation; re-baseline once it settles.
    window.setTimeout(() => {
      baseline = window.innerHeight;
      apply();
    }, 250);
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
    // The native shell reports the IME height through this event (see main.ts).
    window.addEventListener("astrbot:viewport", apply);
    window.addEventListener("orientationchange", onOrientationChange);
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
    window.removeEventListener("astrbot:viewport", apply);
    window.removeEventListener("orientationchange", onOrientationChange);
    window.removeEventListener("scroll", lockScroll);
    document.removeEventListener("focusin", lockScroll);
    document.removeEventListener("focusin", reapplySoon);
    document.removeEventListener("focusout", reapplySoon);
  });
}
