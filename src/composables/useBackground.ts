/**
 * Background-running helper (mobile).
 *
 * On Android we ask the native layer to move the app into a foreground service
 * with a persistent notification, which is what actually keeps the Socket.io
 * connection (and its auto-reconnect loop) alive when the app is backgrounded or
 * the screen is off. We also nudge the user to exempt the app from battery
 * optimisation, since Doze can otherwise suspend the network.
 *
 * Everything is a no-op on desktop / browser preview where the concept does not
 * apply.
 */
import { isTauri } from "@/api/env";

let requested = false;

export async function requestBackgroundRun(): Promise<boolean> {
  if (!isTauri()) return false;
  if (requested) return true;
  requested = true;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("start_background_service");
    return true;
  } catch (e) {
    console.warn("background service request failed", e);
    return false;
  }
}

export async function stopBackgroundRun(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("stop_background_service");
  } catch (e) {
    console.warn("background service stop failed", e);
  } finally {
    requested = false;
  }
}
