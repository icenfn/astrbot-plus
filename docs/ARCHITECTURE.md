# AstrBot+ 架构说明

## 总体结构

```
┌──────────────────────────── Tauri 窗口 (WebView) ────────────────────────────┐
│  Vue 3 + Vuetify 4 前端                                                       │
│                                                                              │
│   views/            components/                                              │
│   ├─ ChatView ─────► ChatList, ChatWindow(MessageBubble, MessageComposer)    │
│   ├─ ContactsView ─► AstrbotAvatar                                           │
│   └─ SettingsView ─► (开关 / 主题)                                            │
│                                                                              │
│   stores/  (Pinia)                                                           │
│   ├─ settings  ── 连接配置、主题、通知/后台开关、buildClient()                  │
│   └─ chat      ── contacts、threads、发送消息、流式更新                         │
│                                                                              │
│   composables/                                                              │
│   ├─ useNotify ── 系统通知 (Tauri plugin-notification / Web Notification)      │
│   └─ useWindow ── 托盘、后台隐藏、开机自启 (Tauri window/autostart)             │
│                                                                              │
│   api/                                                                       │
│   ├─ client.ts ── AstrbotClient (fetch + SSE 解析)                            │
│   └─ types.ts                                                                │
└──────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ HTTP (Tauri plugin-http，绕过 CORS)
                                   ▼
                        AstrBot HTTP API  /api/v1/*
```

## 数据流：发送一条消息

1. `MessageComposer` 触发 `send` 事件 → `ChatWindow.onSend`。
2. `chatStore.sendMessage(text, contact)`：
   - 在本地线程中追加「用户消息」气泡；
   - 追加一个 `streaming: true` 的「助手」占位气泡；
   - 调用 `AstrbotClient.chatStream(...)`。
3. `chatStream` 以 `enable_streaming: true` POST `/api/v1/chat`，逐行解析 SSE：
   - `session_id` → 记录会话 id（后续轮次带上，保持上下文）；
   - `plain` → 增量文本，累加后 `onDelta` 实时更新助手气泡；
   - `agent_stats` → token 用量；
   - `complete` → 最终完整文本；
   - `end` → 结束。
4. 完成后 `streaming=false`，`ChatWindow` 视情况调用 `notify()` 弹系统通知。

## 后台运行

- `src-tauri/src/lib.rs` 中：
  - 构建系统托盘（`TrayIconBuilder`），托盘菜单含「显示主窗口 / 退出」；
  - 监听 `WindowEvent::CloseRequested`，`hide()` 窗口并 `prevent_close()`，
    从而实现「关闭窗口 = 最小化到托盘」；
  - 注册 `tauri-plugin-notification`、`tauri-plugin-autostart`、`tauri-plugin-http`。
- 前端 `useWindow` 通过 `@tauri-apps/plugin-*` 与上述能力交互（浏览器预览下为 no-op）。

## 权限（capabilities）

`src-tauri/capabilities/default.json` 为主窗口授予：
`core:default`、窗口显示/隐藏/最小化、`notification:default`、`autostart:default`，
以及 `http:default`（允许 `http(s)://*`）——用于访问用户自架的 AstrBot 服务。

## 状态与持久化

- 设置经 `@vueuse/core` 的 `useStorage` 持久化到 `localStorage`（键 `astrbot-plus.settings`）。
- 会话消息保存在内存 `threads` 中；进入会话时按需从 `/api/v1/conversations/{cid}`
  拉取历史并解析（会剥离 AstrBot 注入的 `<system_reminder>` 提示）。
