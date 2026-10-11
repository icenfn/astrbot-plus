## v0.3.2

### 变更

- 🧹 **精简为「Agent」单一聊天形态**：移除「群聊」与「对话（Webchat）」相关代码。客户端现在只保留 **Agent**（AstrBot WebUI「创建机器人」页面创建的机器人）一种聊天对象，聊天列表顶部仅保留一个筛选 **v-chip**。
- 🤖 **术语统一**：原「AI 好友」全部更名为 **Agent**（列表、标题、文案一致）。
- 🗑️ **移除老旧 WebView 兼容**：删除 `@vitejs/plugin-legacy`、`core-js`、`terser` 及相关 legacy 分包配置，构建目标改为现代浏览器（`esnext`）。不再为老旧系统 WebView 生成降级产物。
- 🧱 **代码整理**：删除随通信协议重构后不再使用的组件与模块（旧 HTTP 客户端、联系人项、群聊 / 新建对话弹窗等），并将运行时环境判断抽到独立模块。

### 说明

- 🔖 版本号提升至 `0.3.2`；配套插件 [astrbot-plugin-plus](https://github.com/icenfn/astrbot-plugin-plus) 同步为 `0.3.2`（`0.3.x`）。
- ⚠️ **升级提示**：请配合 `astrbot-plugin-plus >= 0.3.2` 使用；由于移除了群聊 / 对话能力，旧数据中的相关条目将不再展示。

## v0.3.1

### 修复

- 🐛 **修复客户端「websocket error」连接失败**：连接配套插件时若 WebSocket 握手被拦截，客户端会直接报错并中断连接。本次做了两处修复：
  - Tauri 安全策略（CSP）的 `connect-src` 之前只允许 `http:` / `https:`，未包含 `ws:` / `wss:`，导致 WebView 直接拦截 Socket.io 的 WebSocket 握手。现已补上 `ws: wss:`。
  - Socket.io 传输策略由「先 websocket」改为「先 polling 再升级 websocket」，并开启 `tryAllTransports`，即使 WebSocket 不可用也会自动回退到 HTTP 长轮询，不再直接失败。
- 💡 **连接错误提示更清晰**：当出现 WebSocket 相关错误时，设置页会给出更明确的排查提示（检查插件地址 / 端口与网络连通性）。

### 说明

- 🔖 版本号提升至 `0.3.1`；配套插件 [astrbot-plugin-plus](https://github.com/icenfn/astrbot-plugin-plus) 保持 `0.3.x`。

## v0.3.0

### 变更

- 🔌 **全链路改用 Socket.io**：客户端不再直连 AstrBot 的 HTTP 接口，而是通过配套插件（`astrbot_plugin_plus`）的 Socket.io 服务端通信。插件对外只暴露一个端口（默认 `6199`），Agent（机器人）列表与流式聊天均通过该连接完成。
- 🔐 **以 API Key 鉴权**：连接时在 Socket.io 握手 `auth.token` 中携带访问密钥，与插件配置的 `access_key` 一致才允许接入；未配置则不校验。
- 🤖 **「Agent」列表来源**：展示 AstrBot WebUI「创建机器人」页面中的机器人列表。
- 📥 **服务端拉取 + 本地缓存**：Agent 列表从插件拉取并做本地缓存，离线时仍可查看历史；连接恢复后自动同步。
- ⏱️ **连接设置精简**：设置页与连接弹窗为「插件服务器地址 + 访问密钥」，支持测试连接与断开。

### 说明

- 🔖 版本号提升至 `0.3.0`；配套插件 [astrbot-plugin-plus](https://github.com/icenfn/astrbot-plugin-plus) 同步为 `0.3.0`。
