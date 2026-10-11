/**
 * Background-running window helpers: close-to-tray / minimize-to-tray and
 * auto-start. All are no-ops in the browser preview.
 */
import { isTauri } from "@/api/env";

type CloseHandler = (event: { preventDefault: () => void }) => void;

let installed = false;

async function getAppWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export function useWindow() {
  async function hideToTray(): Promise<void> {
    if (!isTauri()) return;
    const win = await getAppWindow();
    await win.hide();
  }

  async function showMainWindow(): Promise<void> {
    if (!isTauri()) return;
    const win = await getAppWindow();
    await win.show();
    await win.unminimize();
    await win.setFocus();
  }

  /**
   * Intercept the window close button. When `closeToTray` is enabled, the
   * window is hidden instead of destroyed so the app keeps running in the
   * background and can still raise notifications.
   */
  async function installCloseHandler(options?: {
    closeToTray?: boolean;
    onClose?: () => void;
  }): Promise<void> {
    if (!isTauri() || installed) return;
    installed = true;
    try {
      const win = await getAppWindow();
      await win.onCloseRequested(async (event) => {
        if (options?.closeToTray !== false) {
          event.preventDefault();
          await win.hide();
          options?.onClose?.();
        }
      });
    } catch (e) {
      console.warn("failed to install close handler", e);
    }
  }

  async function setAutoStart(enabled: boolean): Promise<boolean> {
    if (!isTauri()) return false;
    try {
      const { isEnabled, enable, disable } = await import("@tauri-apps/plugin-autostart");
      const currently = await isEnabled();
      if (enabled && !currently) await enable();
      if (!enabled && currently) await disable();
      return await isEnabled();
    } catch (e) {
      console.warn("autostart toggle failed", e);
      return false;
    }
  }

  async function isAutoStartEnabled(): Promise<boolean> {
    if (!isTauri()) return false;
    try {
      const { isEnabled } = await import("@tauri-apps/plugin-autostart");
      return await isEnabled();
    } catch {
      return false;
    }
  }

  return { hideToTray, showMainWindow, installCloseHandler, setAutoStart, isAutoStartEnabled };
}
