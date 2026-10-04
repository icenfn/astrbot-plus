import { isTauri } from "@/api/client";

/**
 * Cross-environment desktop notifications.
 * Inside Tauri we use the official notification plugin (which also wires into
 * the OS notification center); in a browser preview we fall back to the Web
 * Notification API so the UI can still be demoed.
 */
export interface NotifyOptions {
  title: string;
  body: string;
  /** When true, do not show if the window is focused/visible. */
  onlyWhenUnfocused?: boolean;
  onClick?: () => void;
}

let tauriNotify: ((opts: NotifyOptions) => Promise<void>) | null = null;
let permissionRequested = false;

async function ensureTauriNotify() {
  if (tauriNotify) return tauriNotify;
  const mod = await import("@tauri-apps/plugin-notification");
  tauriNotify = async (opts: NotifyOptions) => {
    let granted = await mod.isPermissionGranted();
    if (!granted) {
      const perm = await mod.requestPermission();
      granted = perm === "granted";
    }
    if (!granted) return;
    mod.sendNotification({ title: opts.title, body: opts.body });
  };
  return tauriNotify;
}

async function ensureWebPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  if (permissionRequested) return false;
  permissionRequested = true;
  const perm = await Notification.requestPermission();
  return perm === "granted";
}

export async function notify(opts: NotifyOptions): Promise<void> {
  if (opts.onlyWhenUnfocused && document.visibilityState === "visible" && document.hasFocus()) {
    return;
  }
  try {
    if (isTauri()) {
      const fn = await ensureTauriNotify();
      await fn(opts);
      return;
    }
    const granted = await ensureWebPermission();
    if (!granted) return;
    const n = new Notification(opts.title, { body: opts.body, icon: "/logo.svg" });
    if (opts.onClick) n.onclick = () => opts.onClick?.();
  } catch (e) {
    // Notifications are best-effort; never break the chat flow.
    console.warn("notification failed", e);
  }
}
