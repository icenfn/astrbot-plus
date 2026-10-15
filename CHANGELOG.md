## v0.4.18

### 修复
- 📱 **修复旧版 Android WebView（91 等 Chromium < 99）下按钮变黑、卡片阴影缺失、主题色不生效**：由两个原因叠加导致。
  - Vuetify 4 在运行时用 `@layer vuetify-utilities { theme-base / theme-background / theme-foreground }` 包裹它动态注入的主题样式表 `#vuetify-theme-stylesheet`。WebView 91 不认识 `@layer`，会把整张样式表连同 `--v-theme-*`、`--v-shadow-color`、`--v-elevation-overlay-color`、`--v-*-opacity` 等变量一并丢弃。新增 `src/compat/legacy-css.ts`：在不支持 CSS 级联层的引擎上，把这张运行时样式表就地「压平」并保留原有的 `theme-base → theme-background → theme-foreground` 声明顺序；支持 `@layer` 的现代浏览器完全不受影响（零行为变化）。
  - 静态样式里的 `color-mix()` 无法被 `postcss-preset-env` 降级（颜色参数含运行时 `var()`，构建时不可解析），而 WebView 91 同样不支持 `color-mix()`。新增本地 PostCSS 插件 `color-mix-fallback`，把 Vuetify「运行时常量 + `transparent`」的混合改写为等价的 `rgba(var(…), α)`（涵盖 `var(--c) N%, transparent`、`rgb(var(--c)) N%, transparent` 与 `rgb(var(--c)) calc(var(--o) * 100%), transparent` 三种形态），并把主题里的 `elevation-overlay-color` 覆写为 `#FFFFFF` / `#000000`，使其被序列化为 `rgba()` 可用的三元组。
- 💬 **修复历史消息「少获取」**：`loadHistory` 过去只用「角色 + 文本」判断历史与本地消息的重复，导致内容相同的合法消息（例如同一句话连续发送两次）被误判为重复而丢弃，重新进入会话时看起来「少了几条」。现改为「角色 + 文本 + 时间戳（精确到秒）」，只有真正重复的同一条消息才会被合并。
- 🕒 **修复聊天消息偶发顺序错误**：`loadHistory` 过去把本地尚未同步的消息直接追加到历史末尾，只要本地消息早于服务端最新一批，顺序就会错乱。现对合并后的整个会话按 `created_at` 做稳定排序，保证时间正序。

### 变更
- 🧹 **精简「Agent 信息」页**：删除「启用状态」「平台适配器」「插件端口」三项，并将「显示名称」改名为「昵称」。
- 🔖 版本号提升至 `0.4.18`。

## v0.4.17

### 修复
- 💬 **修复消息页面顶部/底部没有安全边距**：`ChatWindow` 的会话头部此前缺少顶部安全区，现补上 `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))`，会话页标题栏不再顶到状态栏/刘海下。
- ⌨️ **修复消息页面底部输入框被系统输入法（键盘）遮住**：这是上一版改为 edge-to-edge 后遗留的问题——WebView 不再随键盘自动缩放，输入框被键盘盖住。现由原生 `MainActivity` 监听 IME inset，把键盘高度以 `--keyboard-height` 变量下发给 WebView（`window.__astrbotApplyInsets(..., keyboard)`），并在打开键盘时让 `--safe-area-inset-bottom` 扣掉键盘占用的高度（避免「键盘 + 导航栏」重复留白）。前端 `useVisualViewport` 以「关闭键盘时的最大布局高度 − 键盘高度」计算 `--app-height`，锁定 body 滚动并重新吸附到底部，输入框始终贴在键盘正上方。

### 变更
- 🧩 **回退为 PostCSS + polyfill**：撤销上一版的 LightningCSS 方案，恢复 `postcss.config.js`（`postcss-preset-env` stage 2 + 本地 viewport-unit-fallback 插件）与原始的 Vite CSS 配置，移除 `lightningcss`/`browserslist` 依赖、恢复 `postcss`/`postcss-preset-env`/`autoprefixer`，继续支持 Android WebView ≥ 90。并修正 viewport-unit-fallback 插件对动态视口单位的匹配——原先用 `\b(dvh|…)` 无法命中 `100dvh`（`0` 与 `d` 之间没有词边界），导致 WebView 90+ 缺少 `vh` 回退；现改为「数字 + 单位」匹配，`100dvh`、`calc(100dvh - …)`、`0.5svh` 等均能正确生成 `vh/vw` 回退。
- 🔖 版本号提升至 `0.4.17`。
