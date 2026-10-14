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
