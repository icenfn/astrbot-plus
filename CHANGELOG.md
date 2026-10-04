# Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## v0.1.2

### 新增

- 📡 **API 请求层迁移到 [alova](https://alova.js.org/)**：使用 `createAlova` + `alova/fetch` 适配器统一请求与错误处理，流式聊天继续保持 SSE 增量解析。

### 修复

- 💬 **修复进入消息页不加载历史消息**：会话详情接口返回的是 `{status, message, data}` 信封，之前误将整个信封当作会话对象解析，导致 `history` 永远为空；现正确解包 `data`，并使用会话自身的 `user_id` 作为查询参数。
- 📱 **移动端禁用双指缩放**：补充 `user-scalable=no` 视口设置、`touch-action` 与手势拦截，避免 WebView 被双指放大。
- ⌨️ **修复移动端输入框被输入法遮挡**：视口启用 `interactive-widget=resizes-content`，布局改用 `dvh`，Android 端清单启用 `adjustResize`，输入框始终位于键盘上方。
- 🧭 **修复消息页底部 Tab 栏残留**：打开会话的消息页为全屏页面，移动端不再显示底部 Tab 栏。
- 🎨 **图标回归原始设计并参照 DHThub 方案**：使用仓库根目录 `app-icon.png` 通过 `npx tauri icon` 统一生成桌面与 Android 全套图标，移除手工分层图标脚本，观感与原版一致。

## v0.1.1

### 修复

- 🔌 **修复访问自建 AstrBot 服务器报错 `url not allowed on the configured scope`**：HTTP 权限作用域由 `http://*` / `https://*` 改为 `http://*:*` / `https://*:*`，此前省略端口只匹配默认端口（80/443），导致非标准端口（如 `:6185`）被拒绝。
- 🎨 **修复应用图标被放大/裁剪的问题**：桌面图标重新生成并预留约 7% 边距；Android 自适应图标改为「透明前景 + 纯色品牌背景」，前景缩放到安全区内，不再出现星芒被放大的观感，同时补齐圆形图标与 Android 8+ 自适应图标配置。

## v0.1.0

首个公开版本。

### 新增

- 💬 纯文字**单聊**与**群聊**，基于 AstrBot OpenAPI（`POST /api/v1/chat`）的 SSE 流式回复
- 🗂️ 会话列表（`GET /api/v1/conversations`），支持「全部 / 单聊 / 群聊」筛选与搜索
- 📜 进入会话时加载历史记录并解析（自动剥离系统注入的 `<system_reminder>`）
- 🔔 系统通知，支持「仅后台 / 窗口未聚焦时通知」
- 🪟 桌面端后台运行：系统托盘、关闭窗口最小化到托盘、开机自启
- 📱 移动端布局：底部 Tab 栏（替代侧边栏）+ 单栏聊天（列表 ⇄ 会话）
- 🌗 深色 / 浅色 / 跟随系统主题
- 🎨 基于 AstrBot 官方 favicon 二次创作的应用图标

### 构建

- 🖥️ 桌面端：Linux（deb / rpm）、Windows（NSIS）
- 🤖 移动端：Android（arm64 / armv7，已配置签名）
