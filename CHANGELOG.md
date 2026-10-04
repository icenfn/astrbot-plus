# Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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
