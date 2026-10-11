# AstrBot+ 架构说明

## 总体结构

```
┌──────────────────────────── Tauri 窗口 (WebView) ────────────────────────────┐
│  Vue 3 + Vuetify 4 前端                                                       │
│                                                                              │
│   views/            components/                                              │
│   ├─ ChatView ─────► ChatList, ChatWindow(MessageBubble, MessageComposer)    │
│   ├─ ContactsView ─► AstrbotAvatar                                           │
│   └─ SettingsView ─► (连接 / 主题)                                            │
│                                                                              │
│   stores/  (Pinia)                                                           │
│   ├─ settings ── 插件地址、主题、Socket 生命周期（getSocket）                   │
│   └─ chat     ── contacts、threads、发送消息、流式更新                          │
│                                                                              │
│   api/                                                                       │
│   ├─ socket.ts ── PlusSocket（Socket.io 连接、事件收发）                       │
│   └─ types.ts / env.ts                                                       │
└──────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ Socket.io（ws://，默认端口 6199）
                                   ▼
                  AstrBot 服务端插件 astrbot-plugin-plus
                  （平台适配器 astrbot_plus，消息进出 AstrBot 事件管线）
```

## 数据流：发送一条消息

1. `MessageComposer` 触发 `send` → `ChatWindow.onSend`。
2. `chatStore.sendMessage(text, contact)`：
   - 本地追加「用户消息」气泡；
   - 追加一个 `streaming: true` 的「助手」占位气泡；
   - 通过 `PlusSocket` 发送 `chat:send`（携带 `text` / `botId` / `sessionId` / `reqId`）。
3. 插件将消息投入 AstrBot 事件管线，回复经事件流式回推：
   - `chat:session` → 服务端确认的稳定会话 id（后续轮次带上，保持上下文）；
   - `chat:delta` → 增量文本，实时更新助手气泡；
   - `chat:done` → 最终完整文本，气泡结束流式状态；
   - `chat:error` → 错误提示。
4. 完成后 `streaming=false`，视情况弹系统通知。

## 连接管理

- `settings` store 持有唯一的 `PlusSocket` 实例（`getSocket()`），连接配置仅存
  `socketUrl`（插件地址，支持 `host:6199` / `http://…` / `ws://…`，无需密钥）。
- 断线重连、传输升级（polling → websocket）由 socket.io-client 负责；
  `connect_error` 时给出可读提示。

## 后台运行（桌面端）

- `src-tauri/src/lib.rs`：系统托盘（显示主窗口 / 退出）、关闭窗口即最小化到托盘
  （`CloseRequested` → `hide()` + `prevent_close()`）、注册
  `notification` / `autostart` / `http` 插件。
- 前端 `useWindow` 通过 `@tauri-apps/plugin-*` 调用上述能力（浏览器预览下为 no-op）。

## 状态与持久化

- 设置持久化到 `localStorage`（键 `astrbot-plus.settings`），含旧版主题名迁移。
- 会话消息保存在内存 `threads` 中。
