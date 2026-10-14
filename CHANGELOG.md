## v0.4.12

### 修复
- 📱 **修复旧版 Android WebView（目标 WebView 91 / Chromium 91）兼容**：上一版仅做了基础配置，实测旧 WebView 仍无法正常渲染，本次定位并修复两处真正的原因：
  1. **样式层（关键）**：Vuetify 4 将绝大多数组件样式包裹在 `@layer vuetify-*` 级联层内，而 Chromium < 99 不认识 `@layer`，遇到无法识别的 at-rule 会**整块丢弃**其中的样式，导致旧 WebView 上组件样式全部失效、UI 直接崩坏。现引入 `@csstools/postcss-cascade-layers` 将级联层压平为等价的高特异性选择器（`:not(#\#)`），使样式在 WebView 91 上正常生效；并用 `@csstools/postcss-color-mix-function` 为 `color-mix()`（Chrome 111+）生成静态 `rgb()` 回退。
  2. **脚本层**：WebView 91 支持原生 ESM，会被 `@vitejs/plugin-legacy` 判定为「现代浏览器」并加载 **modern** 包——而上一版的 modern 包既未按旧基线降级、也未注入任何 polyfill。现为 modern 包设置 `modernTargets`（Chromium 87 基线）并开启 `modernPolyfills`，按旧基线降级 JS 语法并注入 `core-js`（如 `Object.hasOwn`、`Array.prototype.at`、`structuredClone` 等）。
- 🔗 统一 `browserslist` 与构建基线（`chrome >= 61` 等），确保 Autoprefixer 与 Babel/legacy 面向一致的浏览器下限。

### 说明
- 职责边界：PostCSS 只负责**样式表**降级，`@vitejs/plugin-legacy` 负责 **JS 语法 + 运行时 polyfill**，二者互不重叠；`postcss-preset-env` 内置 Autoprefixer 已关闭，避免前缀器重复运行。

## v0.4.11

### 修复
- 💬 **消息气泡占位 / 动画**：发送后不再先插入一个空的「占位」助手气泡。助手气泡改为**按需创建**——流式回复在首个增量到达时才出现、并原地增长；关闭流式（非流式）的机器人则在 `chat:done` 一次性插入完整回复。彻底去掉了打字光标与闪烁动画，流式/非流式均为纯文本直接输出。
- 🧹 **移除「输出工具调用信息 / 显示思考内容」处理**：删除客户端对 `🤔 思考:` / `🔨 调用工具:` 标记的解析与渲染（含 `utils/messageSegments.ts`、`ChatMessage` 的 `reasoning`/`toolCalls` 字段、气泡内的工具标签与「思考内容」折叠面板）。回复文本原样展示。
- 🏠 **移除首页顶部「在线 / 离线」标签**：删除消息页头部的状态 `v-chip` 及相关绑定。

### 优化
- ♻️ **清理冗余 / 不合理代码**：移除未使用的 `BotInfo` 类型、`chat` store 中的 `filter`/`openTarget`/`unbindFeed`（含孤儿 `feedOff`）、`ChatWindow` 的内联 `subtitle` 常量，简化消息镜像去重逻辑（仅按角色+文本判重）。
- 🎨 **UI 统一为 Vuetify 自带组件**：`ChatWindow` 的「回到底部」浮动按钮由手写 `<button>` + 自定义样式改为 `v-btn`（`icon` / `variant` / `size`），在保持 v0.4.10 视觉风格的前提下统一交互与主题表现。

### 构建
- 📦 **旧 WebView 兼容**：新增 `@vitejs/plugin-legacy`（`vite.config.ts`）与 `postcss.config.js`（`postcss-preset-env` + 单一 `autoprefixer`）。两者边界清晰——PostCSS 只降级**样式表**，legacy 插件负责注入 `core-js`/`regenerator-runtime` 生成 SystemJS 旧版包；二者共用同一份 `browserslist`，且 `postcss-preset-env` 内置 autoprefixer 已关闭，避免前缀器重复运行。
- 🔖 版本号提升至 `0.4.11`（`package.json` / `tauri.conf.json` / `Cargo.toml` 同步）。

## v0.4.10

### 修复
- 🛠️ **修复构建失败（#28）**：上一版移除设置页同步计数时，误删了 `SettingsView.vue` 中仍在使用的 `storeToRefs` 导入，导致 `vue-tsc` 报 `TS2304: Cannot find name 'storeToRefs'` 并使 Release 构建失败。本次恢复该导入，`vue-tsc --noEmit` 与 `vite build` 均已通过。

### 优化
- ♻️ **引入 VueUse 减少样板代码**：使用 `@vueuse/core` 的 `useEventListener` 统一接管窗口/文档事件监听，替代手写 `addEventListener` + `onBeforeUnmount` 解绑：
  - `stores/chat.ts`：窗口 `focus` 与 `visibilitychange` 监听
  - `App.vue`：Android 硬件返回键 `android:back` 监听
  - `components/MessageComposer.vue`、`components/ChatWindow.vue`：`visualViewport` 的 `resize`/`scroll` 监听
  监听随组件作用域自动解绑，减少重复的清理代码、更易维护。
