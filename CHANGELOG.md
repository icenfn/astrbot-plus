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

- 🔌 **全链路改用 Socket.io**：客户端不再直连 AstrBot 的 HTTP 接口，而是通过配套插件（`astrbot_plugin_plus`）的 Socket.io 服务端通信。插件对外只暴露一个端口（默认 `6199`），机器人列表、对话列表 / 新建 / 删除、历史记录与流式聊天均通过该连接完成。
- 🔐 **以 API Key 鉴权**：连接时在 Socket.io 握手 `auth.token` 中携带访问密钥，与插件配置的 `access_key` 一致才允许接入；未配置则不校验。
- 💬 **新增「对话」聊天类别**：「对话」直接对应 AstrBot 的 Webchat 会话，与 WebUI 里的机器人 1:1 绑定；聊天类别现在为「对话 / AI 好友 / 群聊」三种。
- ➕ **「新建 AI 好友」改为「新建对话」**：聊天列表右上角「+」可新建对话，并可选绑定一个机器人；绑定后再次新建会复用已有对话（一个机器人对应一个对话）。
- 🤖 **「AI 好友」列表来源调整**：改为展示 AstrBot WebUI「创建机器人」页面中的机器人列表。
- 📥 **服务端拉取 + 本地缓存**：机器人 / 对话列表从插件拉取并做本地缓存，离线时仍可查看历史；连接恢复后自动同步。
- ⏱️ **连接设置精简**：设置页与连接弹窗改为「插件服务器地址 + 访问密钥」，支持测试连接与断开。
- 👥 **群聊保留**：群聊功能保留（本地维护、消息扇出），Socket.io 化的细化开发留待后续版本。

### 说明

- 🔖 版本号提升至 `0.3.0`；配套插件 [astrbot-plugin-plus](https://github.com/icenfn/astrbot-plugin-plus) 同步为 `0.3.0`。
- ⚠️ **升级提示**：本次为通信协议的重大变更，客户端需配合 `astrbot-plugin-plus >= 0.3.0` 使用，并在设置中填写插件地址与访问密钥。
