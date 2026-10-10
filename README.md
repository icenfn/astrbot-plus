<div align="center">
  <img src="public/logo.svg" alt="AstrBot+ Logo" width="110" height="110">

  # AstrBot+

  **AstrBot+ — 一个现代化的 AstrBot 桌面 / 移动客户端**

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)](https://tauri.app/)
  [![Vue](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
  [![Vuetify](https://img.shields.io/badge/Vuetify-4.x-1867C0?logo=vuetify&logoColor=white)](https://vuetifyjs.com/)
  [![Release](https://github.com/icenfn/astrbot-plus/actions/workflows/release.yml/badge.svg)](https://github.com/icenfn/astrbot-plus/actions/workflows/release.yml)

  基于 Tauri 2 + Vue 3 + Vuetify 4 + Pinia + VueUse，通过 Socket.io 与配套插件通信。
  支持 **桌面端（Windows / macOS / Linux）** 与 **Android**。

</div>

---

## ✨ 简介

AstrBot+ 是一个开源、跨平台的 [AstrBot](https://astrbot.app) 客户端。界面参考
Telegram 重新设计，采用 Vuetify 4 组件库构建。当前版本聚焦于**纯文字聊天**这一核心场景。

### 已实现功能

- 💬 **对话（Webchat）**：新建对话直接与 AstrBot 的 Webchat 沟通，流式展示回复；一个机器人对应一段对话
- 🤖 **AI 好友（私聊）**：来自 AstrBot WebUI「创建机器人」页面的机器人，拥有独立的会话上下文，流式展示回复
- 👥 **群聊**：把**多个 AI 好友拉进同一个群聊**；发送消息时文本同时发给每位成员，且**群内每位 AI 拥有独立会话上下文**（独立 UMO / session），互不串扰
- 🗂️ **统一聊天列表**：对话、AI 好友与群聊统一展示，支持按「全部 / 对话 / AI 好友 / 群聊」筛选与搜索
- 🔌 **Socket.io 通信**：[astrbot-plugin-plus](https://github.com/icenfn/astrbot-plugin-plus) 提供 Socket.io 服务端（对外只暴露一个端口），机器人 / 对话列表由服务端拉取、客户端本地缓存，联网时自动同步，离线可用本地数据
- 📜 **历史记录**：显示历史消息（自动剥离系统注入的 `<system_reminder>`）
- ⬇️ **自动滚动到底部**：跟随最新消息；上翻历史时显示悬浮「向下箭头」按钮，点击回到底部并自动隐藏
- 🔔 **系统通知**：收到回复时调用系统通知，可设置为「仅后台通知」
- 🪟 **后台运行**（桌面）：关闭窗口时最小化到系统托盘（不退出），托盘菜单可显示窗口 / 退出
- 🚀 **开机自启**（桌面）：可选开机自动启动
- 📱 **移动端布局**：窄屏（≤900px）自动切换为**底部 Tab 栏**（替代侧边栏）+ 单栏聊天、返回键处理、系统栏安全区适配
- ⌨️ **键盘安全输入底栏**：输入底栏绑定可视视口（`visualViewport`），移动端输入法不再遮挡输入框
- 🔤 **Markdown 气泡**：消息气泡使用 [marked](https://marked.js.org/) v18 渲染，支持 KaTeX 数学公式、ABC 乐谱与 highlight.js 代码高亮
- 🌗 **主题**：深色 / 浅色 / 跟随系统
- 🎨 **二创图标**：应用图标基于 AstrBot 官方 favicon 二次创作

### 技术栈

| 层 | 技术 |
| --- | --- |
| 应用框架 | [Tauri 2](https://tauri.app/)（桌面 + Android/iOS） |
| 前端 | [Vue 3](https://vuejs.org/) + TypeScript |
| UI 组件库 | [Vuetify 4](https://vuetifyjs.com/) |
| 状态管理 | [Pinia](https://pinia.vuejs.org/) |
| 组合式工具 | [VueUse 15](https://vueuse.org/) |
| 构建 | [Vite](https://vitejs.dev/) |
| 后端 | Rust |

## 📦 下载

前往 [**Releases**](https://github.com/icenfn/astrbot-plus/releases) 下载：

| 平台 | 产物 |
| --- | --- |
| Windows | `astrbot-plus-<版本>-windows-x64-setup.exe` |
| Linux | `astrbot-plus-<版本>-linux-arm64.deb` / `…-linux-aarch64.rpm` |
| Android | `astrbot-plus-<版本>-android-arm64.apk` |

发布由 [`.github/workflows/release.yml`](.github/workflows/release.yml) 统一完成：
读取 `CHANGELOG.md` 的最新版本号，三端并行构建后在**同一个工作流**里汇总创建
GitHub Release。

## 🔌 通信（Socket.io）

AstrBot+ 通过 **Socket.io** 与配套插件 [astrbot-plugin-plus](https://github.com/icenfn/astrbot-plugin-plus)
通信。插件单独监听一个端口（默认 `6199`），对外只暴露这一个端口；客户端在设置中填写
「插件服务器地址」与「访问密钥（API Key）」，握手时以 `auth.token` 完成鉴权。

| 用途 | Socket.io 事件 |
| --- | --- |
| 心跳 / 能力信息 | `ping` / `config` |
| 机器人列表（WebUI「创建机器人」） | `bots:list` |
| 对话（Webchat 会话）列表 / 新建 / 删除 / 历史 | `dialogs:list` / `dialogs:create` / `dialogs:delete` / `dialogs:history` |
| 发送消息并流式获取回复 | `chat:send` → `chat:delta` / `chat:done` / `chat:error` |
| AI 好友 / 群聊注册表 | `registry:list` / `registry:*:upsert` / `registry:*:delete` |

> 插件侧会以你配置的 `astrbot_api_key` 调用 AstrBot 自身的接口（机器人配置、Webchat 会话、
> 流式聊天）。参考文档 <https://docs.astrbot.app/>。

## 🚀 开发

### 环境要求

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://rustup.rs/)（stable，构建 Tauri 需要）
- 桌面端系统依赖见 [Tauri 官方文档](https://tauri.app/start/prerequisites/)
- Android 端另需 JDK 17、Android SDK、Android NDK

### 命令

```bash
npm install          # 安装依赖
npm run dev          # 仅前端预览（http://localhost:1420）
npm run tauri dev    # 完整桌面应用（开发模式）
npm run build        # 类型检查 + 前端构建
npm run tauri build  # 打包桌面应用
```

## 📱 Android 打包与签名

Android 相关细节见 [`docs/MOBILE.md`](./docs/MOBILE.md)。要点：

- 已配置 `bundle.android`（minSdk 24），并限制 ABI 为 **arm64（aarch64）**
- **图标**：`tauri android init` 会写入模板默认图标，构建流程会用
  `src-tauri/icons/android/` 覆盖为 AstrBot+ 自定义图标
- **签名**：仓库内置稳定 `android/debug.keystore` 作为默认签名，保证跨版本覆盖安装；
  如需正式发布，配置 Secrets 即可（见下）

```bash
npm run android:init     # 生成原生工程 src-tauri/gen/android
npm run android:dev      # 真机 / 模拟器调试
npm run android:build:apk
```

### 正式签名（可选）

在仓库 **Settings → Secrets and variables → Actions** 添加：

| Secret | 说明 |
| --- | --- |
| `ANDROID_KEY_BASE64` | keystore 文件的 base64（`base64 -w0 release.keystore`） |
| `ANDROID_KEY_ALIAS` | 密钥别名 |
| `ANDROID_KEY_PASSWORD` | storePassword 与 keyPassword |

配置后 CI 自动使用正式签名；未配置时回退到内置 debug 签名。

## 📁 项目结构

```
astrbot-plus/
├── CHANGELOG.md                 # 版本与发布说明（Release 取自此处）
├── public/logo.svg              # 二创品牌图标
├── android/debug.keystore       # 内置稳定 debug 签名
├── .github/workflows/release.yml# 三端合并构建 + 发布
├── src/
│   ├── api/                     # Socket.io 客户端（socket.ts）+ 类型
│   ├── stores/                  # settings / chat（Pinia）
│   ├── composables/             # useNotify / useWindow / usePlatform
│   ├── components/              # 侧栏、底部 Tab、会话列表、聊天窗口、气泡、输入框…
│   ├── views/                   # ChatView / SettingsView
│   ├── plugins/vuetify.ts       # Vuetify 主题与图标
│   └── styles/main.scss
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json          # 含 bundle.android
    ├── capabilities/            # default.json（桌面） / mobile.json（Android/iOS）
    ├── icons/                   # 由 logo.svg 生成（含 android/ ios/ 子目录）
    └── src/lib.rs               # 托盘/后台(桌面) + 插件注册
```

## 🎨 关于图标

`public/logo.svg` 与 `src-tauri/icons/*` 基于 AstrBot 官方 favicon
(<https://docs.astrbot.app/favicon.svg>) **二次创作**：保留其标志性的「星芒」形态，
重新配色为蓝色渐变并叠加一个 "+" 徽标，以呼应应用名 **AstrBot+**。

重新生成图标：

```bash
inkscape public/logo.svg --export-type=png --export-filename=logo.png -w 1024 -h 1024
npx tauri icon logo.png
```

图标版权归原 AstrBot 项目所有，本仓库的二创图标依 MIT 协议分发。

## 🔒 隐私

- 所有凭据（插件服务器地址、访问密钥）仅保存在本地（浏览器 `localStorage`）。
- Socket.io 连接直接发往你配置的插件服务器，不经过任何第三方。

## 📄 许可证

本项目基于 [MIT](./LICENSE) 许可证开源。

## ⚠️ 免责声明

AstrBot+ 是社区开发的第三方客户端，与 AstrBot 官方无隶属关系。使用前请确保你拥有
所连接 AstrBot 服务的合法访问权限。
