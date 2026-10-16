/**
 * Background-running + notification-permission helpers (mobile).
 *
 * On Android the native shell exposes a `window.AstrbotNative` bridge. We use it to
 * ask for the POST_NOTIFICATIONS permission and to be exempted from battery
 * optimisation, and we ask the Rust side to move the app into a foreground service
 * with a persistent notification — which is what actually keeps the Socket.io
 * connection (and its auto-reconnect loop) alive when the app is backgrounded or the
 * screen is off.
 *
 * IMPORTANT: nothing here runs on app launch. Both permissions are requested only
 * AFTER the user opts in (设置 → 后台运行 / 通知, or the 向导 final step), so a cold
 * start never raises a system prompt.
 *
 * Everything is a no-op on desktop / browser preview where the concept does not apply.
 */
import { isTauri } from "@/api/env";

interface AstrbotNative {
  requestBackgroundPermissions?: () => void;
  requestNotificationPermission?: () => void;
}

function native(): AstrbotNative | undefined {
  return (window as unknown as { AstrbotNative?: AstrbotNative }).AstrbotNative;
}

let requested = false;

/**
 * Ask the OS to keep the app alive in the background. Also (re)raises the
 * notification + battery-optimisation permission prompts, because this is only
 * ever called from an explicit user opt-in.
 */
export async function requestBackgroundRun(): Promise<boolean> {
  if (!isTauri()) return false;
  native()?.requestBackgroundPermissions?.();
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

/**
 * Ask the OS (Android 13+) for the POST_NOTIFICATIONS runtime permission. Called
 * on demand when the user turns notifications on, never on launch.
 */
export function requestNotificationPermission(): void {
  if (!isTauri()) return;
  native()?.requestNotificationPermission?.();
}
