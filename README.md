<div align="center">
  <img src="public/logo.svg" alt="AstrBot+ Logo" width="110" height="110">

  # AstrBot+

  **AstrBot+ — 一个现代化的 AstrBot 桌面客户端**

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)](https://tauri.app/)
  [![Vue](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
  [![Vuetify](https://img.shields.io/badge/Vuetify-4.x-1867C0?logo=vuetify&logoColor=white)](https://vuetifyjs.com/)

  基于 Tauri + Vue 3 + Vuetify 4 + Pinia + VueUse，通过 AstrBot OpenAPI 通信。

</div>

---

## ✨ 简介

AstrBot+ 是一个开源、跨平台的 [AstrBot](https://astrbot.app) 桌面客户端。界面参考
Telegram 重新设计，采用 Vuetify 4 组件库构建。当前版本聚焦于**纯文字聊天**这一核心场景。

### 已实现功能

- 💬 **纯文字单聊**：与 AstrBot 的私聊会话进行文本对话，流式（SSE）展示回复
- 👥 **纯文字群聊**：群会话列表与群聊文本收发
- 🗂️ **会话列表**：从 AstrBot 拉取全部会话（conversations），支持按「全部 / 单聊 / 群聊」筛选与搜索
- 🔔 **系统通知**：收到回复时调用系统通知，可设置为「仅后台通知」
- 🪟 **后台运行**：关闭窗口时最小化到系统托盘（不退出），托盘菜单可显示窗口 / 退出
- 🚀 **开机自启**：可选开机自动启动（基于 autostart 插件）
- 🌗 **主题**：深色 / 浅色 / 跟随系统三种主题
- 🎨 **二创图标**：应用图标基于 AstrBot 官方 favicon 二次创作

### 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面框架 | [Tauri 2](https://tauri.app/) |
| 前端 | [Vue 3](https://vuejs.org/) + TypeScript |
| UI 组件库 | [Vuetify 4](https://vuetifyjs.com/) |
| 状态管理 | [Pinia](https://pinia.vuejs.org/) |
| 组合式工具 | [VueUse 15](https://vueuse.org/) |
| 构建 | [Vite](https://vitejs.dev/) |
| 后端 | Rust |

## 🔌 依赖的 AstrBot OpenAPI

AstrBot+ 仅使用 AstrBot 官方 HTTP API（`Authorization: Bearer abk_xxx`）。参考文档
<https://docs.astrbot.app/dev/openapi.html>。

| 用途 | 接口 |
| --- | --- |
| 发送消息并流式获取回复 | `POST /api/v1/chat` |
| 会话列表 | `GET /api/v1/conversations` |
| 单个会话历史 | `GET /api/v1/conversations/{cid}?user_id=...` |
| 会话（session）列表 | `GET /api/v1/sessions` |
| 主动消息推送 | `POST /api/v1/im/messages` |
| 机器人列表 | `GET /api/v1/im/bots` |
| 提供商列表 | `GET /api/v1/providers` |

> 需要先在 AstrBot 控制台「开发者 / API Key」创建一个包含 chat、im 等 scope 的
> API Key，然后在客户端「设置」中填入服务器地址与 API Key。

## 🚀 开发

### 环境要求

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://rustup.rs/)（stable 即可，构建 Tauri 需要）
- 系统依赖参考 [Tauri 官方文档](https://tauri.app/start/prerequisites/)

### 命令

```bash
# 安装依赖
npm install

# 仅启动前端（浏览器预览 http://localhost:1420）
npm run dev

# 启动完整桌面应用（开发模式，前后端热重载）
npm run tauri dev

# 类型检查 + 构建前端
npm run build

# 打包桌面应用
npm run tauri build
```

## 📁 项目结构

```
astrbot-plus/
├── index.html
├── package.json
├── vite.config.ts
├── public/
│   └── logo.svg                 # 二创品牌图标
├── src/
│   ├── main.ts                  # 应用入口
│   ├── App.vue                  # 根组件（侧栏 + 路由视图）
│   ├── api/
│   │   ├── client.ts            # AstrBot API 客户端（含 SSE 流式解析）
│   │   └── types.ts             # 类型定义
│   ├── stores/
│   │   ├── settings.ts          # 设置 / 连接状态
│   │   └── chat.ts              # 会话 / 消息状态
│   ├── composables/
│   │   ├── useNotify.ts         # 系统通知
│   │   └── useWindow.ts         # 托盘 / 后台 / 自启
│   ├── components/
│   │   ├── AppSidebar.vue        # 左侧导航栏
│   │   ├── ChatList.vue          # 会话列表
│   │   ├── ContactItem.vue       # 会话条目
│   │   ├── ChatWindow.vue        # 聊天窗口
│   │   ├── MessageBubble.vue     # 消息气泡
│   │   ├── MessageComposer.vue   # 输入框
│   │   ├── AstrbotAvatar.vue     # 头像
│   │   └── ConnectionDialog.vue  # 连接对话框
│   ├── views/
│   │   ├── ChatView.vue
│   │   ├── ContactsView.vue
│   │   └── SettingsView.vue
│   ├── plugins/vuetify.ts       # Vuetify 主题与图标
│   ├── router/index.ts
│   └── styles/main.scss
└── src-tauri/
    ├── Cargo.toml
    ├── build.rs
    ├── tauri.conf.json
    ├── capabilities/default.json
    ├── icons/                   # 由 logo.svg 生成的多平台图标
    └── src/
        ├── main.rs
        └── lib.rs               # 托盘、后台运行、插件注册
```

## 🎨 关于图标

`public/logo.svg` 与 `src-tauri/icons/*` 基于 AstrBot 官方 favicon
(<https://docs.astrbot.app/favicon.svg>) **二次创作**：保留其标志性的「星芒」形态，
重新配色为蓝色渐变并叠加一个 "+" 徽标，以呼应应用名 **AstrBot+**。

图标版权归原 AstrBot 项目所有，本仓库的二创图标依 MIT 协议分发。

## 🔒 隐私

- 所有凭据（服务器地址、API Key）仅保存在本地（浏览器 `localStorage`）。
- 请求通过 Tauri HTTP 插件直接发往你配置的 AstrBot 服务器，不经过任何第三方。

## 🤝 贡献

欢迎提交 Issue 与 Pull Request。

## 📄 许可证

本项目基于 [MIT](./LICENSE) 许可证开源。

## ⚠️ 免责声明

AstrBot+ 是社区开发的第三方客户端，与 AstrBot 官方无隶属关系。使用前请确保你拥有
所连接 AstrBot 服务的合法访问权限。
