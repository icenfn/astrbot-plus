## v0.4.16

### 修复
- 📱 **修复部分机型顶部/底部安全距离过大、出现黑边**：原生 `MainActivity` 会在边到边（edge-to-edge）窗口上再对 `decorView` 施加一次系统栏/刘海内边距，与 Web 层 `env(safe-area-inset-*)` 叠加；在会报告非零安全区的机型（刘海屏 / 手势导航）上内边距被计算两次，且窗口背景从状态栏/导航栏区域透出，表现为上下「留黑」。现改为真正的 edge-to-edge：移除原生 `decorView` 内边距，改由原生把系统栏/刘海内边距以 `--safe-area-inset-*` CSS 变量**一次性**下发给 WebView（`window.__astrbotApplyInsets`），Web 层统一以 `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))` 形式消费，内边距只应用一次。

### 构建
- 🧩 **完全移除 PostCSS，改用 LightningCSS**：Vite 的 `css.transformer` 与 `build.cssMinify` 均切换为 `lightningcss`，CSS 目标浏览器取自与 JS 层一致的同一份 `browserslist`（`browserslistToTargets`）。LightningCSS 自身不处理的两处缺口由纯 JS 的本地插件 `scripts/css-legacy-compat.mjs` 补齐：① 级联层压平——按 `:not(#\#)` 特异性重编码（保持 Vuetify 4 的层叠顺序，Chromium < 99 不认识 `@layer` 会整块丢弃）；② 动态视口单位回退——为 `dvh/svh/lvh/dvw/svw/lvw` 注入 `vh/vw` 静态回退（Chromium < 108 无法解析动态视口单位）。移除 `postcss` / `postcss-preset-env` / `autoprefixer` 依赖及 `postcss.config.js`。
- 🔖 版本号提升至 `0.4.16`（`package.json` / `tauri.conf.json` / `Cargo.toml` 同步）。
