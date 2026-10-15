## v0.4.17

### 修复
- 💬 **修复消息页面顶部/底部没有安全边距**：`ChatWindow` 的会话头部此前缺少顶部安全区，现补上 `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))`，会话页标题栏不再顶到状态栏/刘海下。
- ⌨️ **修复消息页面底部输入框被系统输入法（键盘）遮住**：这是上一版改为 edge-to-edge 后遗留的问题——WebView 不再随键盘自动缩放，输入框被键盘盖住。现由原生 `MainActivity` 监听 IME inset，把键盘高度以 `--keyboard-height` 变量下发给 WebView（`window.__astrbotApplyInsets(..., keyboard)`），并在打开键盘时让 `--safe-area-inset-bottom` 扣掉键盘占用的高度（避免「键盘 + 导航栏」重复留白）。前端 `useVisualViewport` 以「关闭键盘时的最大布局高度 − 键盘高度」计算 `--app-height`，锁定 body 滚动并重新吸附到底部，输入框始终贴在键盘正上方。

### 变更
- 🧩 **回退为 PostCSS + polyfill**：撤销上一版的 LightningCSS 方案，恢复 `postcss.config.js`（`postcss-preset-env` stage 2 + 本地 viewport-unit-fallback 插件）与原始的 Vite CSS 配置，移除 `lightningcss`/`browserslist` 依赖、恢复 `postcss`/`postcss-preset-env`/`autoprefixer`，继续支持 Android WebView ≥ 90。并修正 viewport-unit-fallback 插件对动态视口单位的匹配——原先用 `\b(dvh|…)` 无法命中 `100dvh`（`0` 与 `d` 之间没有词边界），导致 WebView 90+ 缺少 `vh` 回退；现改为「数字 + 单位」匹配，`100dvh`、`calc(100dvh - …)`、`0.5svh` 等均能正确生成 `vh/vw` 回退。
- 🔖 版本号提升至 `0.4.17`。
