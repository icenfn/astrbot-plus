/** Runtime environment helpers shared across the app. */

/** Detect whether we are running inside a Tauri webview. */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
