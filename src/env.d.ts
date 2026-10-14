/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

/**
 * Build-time app version, injected by Vite (`define` in vite.config.ts`) from
 * package.json. Used as a fallback on the 关于 page when not running inside a
 * Tauri webview.
 */
declare const __APP_VERSION__: string;
