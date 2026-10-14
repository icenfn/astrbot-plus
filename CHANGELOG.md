## v0.4.15

### 新增
- ℹ️ **「Agent 信息」页面**：聊天消息页面的应用栏右侧新增信息按钮，跳转独立页面 `/agent/:id`（复用「带返回按钮」的通用页面框架）。页面展示该 Agent 的 **bot_id**、显示名称、平台适配器、启用状态，以及配套插件的服务端信息（`config` 事件返回的插件名 / 版本 / 端口）。

### 修复
- 🐛 **修复发送按钮偶发卡在发送状态**：发送 Promise 的 `finish()` 原先以 `settled` 作为短路条件，而 `settled` 正是由流式回调置位——正常 `chat:done` 时 `finish()` 会直接 return，导致 Promise 永不 resolve（一直拖到 120s 看门狗）。现改用独立的 `resolved` 标志，流结束后正确结算。
- 🚫 **禁止长按选择文本**：全局设置 `user-select: none` 与 `-webkit-touch-callout: none`，长按 UI 不再弹出系统选择手柄 / 复制菜单；仅在消息气泡正文（`.md`）与文本输入控件内恢复选择。

### 变更
- 🧹 **联系人页面**：删除「#」分组（改为显式 A–Z 首字母，不再产生「#」桶）；「✦Agents」调整为「✦ Agents」。
- 🎛️ **设置-外观**：主题切换由 `v-select` 改为 `v-btn-toggle`（mandatory / divided / outlined，带图标）。

### 构建
- 🧩 **旧 WebView 兼容再校验（针对整个 Vuetify 4.2.x）**：实测 `@layer` 36 处已全部压平；`color-mix()` / nesting / `oklch()` 由 `postcss-preset-env` `stage:2` 统一降级（单一来源，避免与独立 `@csstools` 插件重复处理冲突）；新增本地 `viewport-unit-fallback` 插件，为 `100dvh` 等动态视口单位补齐 `vh/vw` 回退（Chromium 91 无法解析动态视口单位）。未启用 `enableClientSidePolyfills`（其不会把 polyfill JS 打进产物，只会产生无 JS 支撑的死 CSS 并新增依赖，属应避免的冲突）。
- 🔧 **修复 Release 工作流**：版本号改为以 **git 标签**为准（标签推送用标签名、手动触发可用输入项），仅在没有标签/输入时才回退 CHANGELOG 顶部；避免产物被投递到错误的 Release 导致新 Release 无 Assets。

## v0.4.14

### 新增
- 🧭 **使用 vue-router 组织页面框架**：新增 `HomeLayout`（首页框架）、`MessageLayout`（消息页面框架）、`BackLayout`（带返回按钮的通用页面框架），不再把 `AppTopBar` 写死在 `App.vue`；原 `ChatView` 拆分为 `ChatsView`（首页「消息」标签）与 `ChatSessionView`（单会话 `/chat/:id`）。
- ℹ️ **「关于」页面**：新增 `AboutView`，应用名称 / 应用版本 / Tauri 版本通过 `@tauri-apps/api/app` 获取，非 Tauri 环境回退构建期注入的版本号。

### 变更
- 👥 **联系人页面**：删除顶部搜索框及相关查询逻辑，删除「标签」快捷项，新增「✦Agents」置顶分组。
- 👤 **我的页面**：删除「外观」「消息通知」列表项，「关于 AstrBot+」跳转独立页面。

### 构建
- 🧩 **兼容策略面向整个 Vuetify 4**：`postcss-preset-env` 提升为 `stage: 2` 全量降级；Vite `modernPolyfills` 由「按需」改为覆盖 Vuetify4 / Vue3 运行时的显式全量 `core-js` 列表。
- 🔖 版本号提升至 `0.4.14`（`package.json` / `tauri.conf.json` / `Cargo.toml` 同步）。

## v0.4.13

### 新增
- 🧭 **全局应用栏（App Bar）**：新增应用栏统一显示页面标题（来自路由 `meta.title`），移除了各页面内部重复的「消息」「设置」标题文字；设置等二级页面在应用栏显示返回按钮。
- 👥 **「联系人」页面**：新增独立标签页与页面（UI 原型，暂未接入功能），含搜索框、置顶快捷入口与 A–Z 分组联系人列表，交互参考微信 / Telegram 并做创新。
- 👤 **「我的」页面**：新增独立标签页与页面（UI 原型），包含个人资料卡与功能列表。
- ⚙️ **设置入口迁入「我的」页面**：设置从底部标签栏移出，改为「我的」页面内的入口。

### 变更
- 🗂️ **设置改为独立路由页面**：新增 `/settings` 路由，作为独立页面（带返回按钮）打开；底部标签栏调整为「消息 / 联系人 / 我的」三项。
- 🧹 **移除聊天页顶部搜索框**及 `chat` store 中相关的 `search` / `filteredAgents` 逻辑。
- 🎨 **主题样式统一**：将组件内散落的硬编码边框 / 滚动条颜色（如 `rgba(128,150,170,…)`）统一替换为 Vuetify 主题令牌 `rgba(var(--v-theme-on-surface), …)`，使深浅色主题切换时保持一致；新增页面全部使用 Vuetify 4 自带组件（`v-toolbar` / `v-list` / `v-list-item` / `v-avatar` / `v-badge` / `v-chip` / `v-card` / `v-text-field` 等）。

### 构建（关于 polyfill / PostCSS 策略）
- 🔎 **维持“按需处理”**：评估“全量处理”后会显著增大产物体积（全量 `core-js` 会使包体膨胀、且对旧 WebView 引入冗多余的转换与转译）。因此保留按需：JS 侧 `modernPolyfills: true` 依 `modernTargets` + 实际用法自动检测注入；CSS 侧仍以 `browserslist` 为基准做定向降级（`cascade-layers` / `color-mix` / Autoprefixer）。结论：**全量处理并不更好，故不做此改动。**

## v0.4.12

### 修复
- 📱 **修复旧版 Android WebView（目标 WebView 91 / Chromium 91）兼容**：上一版仅做了基础配置，实测旧 WebView 仍无法正常渲染，本次定位并修复两处真正的原因：
  1. **样式层（关键）**：Vuetify 4 将绝大多数组件样式包裹在 `@layer vuetify-*` 级联层内，而 Chromium < 99 不认识 `@layer`，遇到无法识别的 at-rule 会**整块丢弃**其中的样式，导致旧 WebView 上组件样式全部失效、UI 直接崩坏。现引入 `@csstools/postcss-cascade-layers` 将级联层压平为等价的高特异性选择器（`:not(#\\#)`），使样式在 WebView 91 上正常生效；并用 `@csstools/postcss-color-mix-function` 为 `color-mix()`（Chrome 111+）生成静态 `rgb()` 回退。
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
