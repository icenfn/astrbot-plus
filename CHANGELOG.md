## v0.4.19

### 修复
- 🔔 **修复系统状态栏不显示**：应用为 edge-to-edge（透明状态栏/导航栏），此前状态栏图标沿用系统默认的浅色，在浅色主题的浅背景上「隐形」。现由原生 `MainActivity` 用 `WindowInsetsControllerCompat` 设置 `isAppearanceLightStatusBars` / `isAppearanceLightNavigationBars`，并按「浅色主题→深色图标」的规则与主题保持同步；同时新增 `window.AstrbotNative.setStatusBarAppearance()` 桥接，前端在主题变更时实时下发，桌面/网页环境自动跳过。
- 🌗 **修复旧版 Android WebView（91 等 Chromium < 99）下主题实时切换失效、切主题后组件变黑块**：上一版的运行时去 `@layer` 兼容层只在启动时扫描一次，且观察器仅处理「元素节点」。而 Vuetify 切换主题是通过给 `#vuetify-theme-stylesheet` 赋值 `innerHTML` 完成的，产生的是**文本节点**变更，兼容层因此漏掉——新注入的 `@layer` 主题样式表没有被压平，WebView 91 索性整表丢弃，于是 `--v-theme-*` / 阴影 / 状态色变量全部丢失，组件渲染成黑块、`switch`、`btn` 等也不再跟随主题色。现改为：观察器同时处理 `characterData` 与 `childList`，并从变更目标与新增节点向上回溯定位所属 `<style>` 后压平，主题切换即时生效、无需重启。
- 🧭 **修复首页底部 Tab 栏第一个 Tab 永远处于选中态**：底部导航与侧边栏使用 `v-btn :to`，而 Vuetify 的激活判定基于路由前缀匹配，`to="/"` 会匹配所有以 `/` 开头的路径，导致首个 Tab 恒亮（底色与其它未选中项不同）。现显式传入 `:active="current === tab.name"`，由组件自身的当前路由精确控制选中态。
- 🎨 **修复联系人页顶部快捷入口图标未着色**：快捷入口的图标现使用各自的主题色（`avatar` 采用 `variant="tonal"` 柔和底色 + 同色图标），在深浅主题下都清晰可辨。
- 📐 **优化消息列表与联系人列表的组件间距**：会话列表行距加大（`padding` 8px、行间 4px），联系人列表改为单行样式、行间 6px 并调整分组标题间距，列表更透气、分组层次更清晰。
- 🗑️ **删除联系人列表副标题**：联系人/分组行不再显示副标题（`desc`），仅保留名称。
- ⚡ **缓解启动白屏**：`index.html` 内联首屏背景色（深浅两套，随 `prefers-color-scheme` 切换）并加入轻量加载指示器，WebView 冷启动首帧即是主题背景色，不再先白一段时间才显示内容。

### 变更
- 🧩 **引入 Vuetify 官方特性实践**：
  - `global-configuration`：在 `createVuetify` 中集中配置 `display`（移动端断点 `md` 与自定义 `thresholds`）与 `locale`（`zhHans` + `en` 兜底），替代零散写法。
  - `theme`：巩固以 `theme.change()` 驱动的双主题（`telegramDark` / `telegramLight`），并补齐主题热切换路径的兼容处理。
  - `treeshaking`：确认由 `vite-plugin-vuetify`（`autoImport`）按需引入组件与样式，仅打包实际用到的组件。
- 🔍 **复核 polyfills / PostCSS 覆盖面**：确认 `browserslist` 为 `chrome >= 61, safari >= 12, firefox >= 60, edge >= 79` 的**通用范围**（向下覆盖 Android WebView ≥ 61，含 ≥ 90，向上覆盖到最新版），并非只针对个别版本；构建期 CSS 降级（`postcss-preset-env` stage 2 + 动态视口单位回退 + `color-mix` 回退）全局生效，运行时兼容层按特性检测，现代浏览器走原生路径、零行为变化。
- 🔖 版本号提升至 `0.4.19`。

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
