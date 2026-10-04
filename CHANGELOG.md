# Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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
