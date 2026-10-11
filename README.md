<div align="center">

# AstrBot+

**AstrBot 的跨平台客户端** · 桌面 (Windows / Linux) 与 Android

Telegram 风格界面 · 流式对话 · 系统通知 · 后台驻留

</div>

## 简介

AstrBot+ 是 [AstrBot](https://github.com/AstrBotDevs/AstrBot) 的开源第三方客户端，
基于 Tauri 2 + Vue 3 + Vuetify 4 构建，同一套代码同时编译桌面端与 Android 端。
配合服务端插件 [astrbot-plugin-plus](https://github.com/icenfn/astrbot-plugin-plus)
使用，即可在桌面与手机上与你的 AstrBot Agent 对话。

## 功能

- 💬 **流式对话**：消息实时流式渲染，支持 Markdown / 代码高亮。
- 🤖 **多 Agent**：自动列出服务端 AstrBot+ 平台机器人，随意切换对话。
- 🎨 **Telegram 风格 UI**：深色 / 浅色双主题，气泡消息、已读回执样式。
- 🔔 **系统通知与后台驻留**（桌面端）：托盘图标、新消息通知、开机自启。
- 📱 **Android 适配**：底部 Tab 导航、安全区适配、返回键处理。

## 安装

前往 [Releases](https://github.com/icenfn/astrbot-plus/releases) 下载对应平台的安装包
（Windows `.exe` / Linux `.deb`/`.rpm` / Android `.apk`）。

服务端需安装配套插件 [astrbot-plugin-plus](https://github.com/icenfn/astrbot-plugin-plus)
（默认端口 `6199`），然后在客户端「设置 → 连接」中填入插件地址
（如 `http://<服务器IP>:6199`）即可，无需密钥。

## 开发

```bash
npm install          # 安装依赖
npm run dev          # 仅前端开发 (Vite)
npm run tauri dev    # 完整桌面应用开发
npm run tauri build  # 打包安装包
```

更多细节见 [docs/](docs/)：架构说明 · 开发指南 · 多端适配。

## 许可

见 [LICENSE](./LICENSE)。
