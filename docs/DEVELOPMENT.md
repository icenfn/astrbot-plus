# 开发指南

## 环境

- Node.js ≥ 18
- Rust（stable）
- 平台依赖见 <https://tauri.app/start/prerequisites/>

## 常用命令

```bash
npm install          # 安装依赖
npm run dev          # 仅前端（Vite，端口 1420）
npm run tauri dev    # 完整桌面应用（开发）
npm run build        # vue-tsc 类型检查 + vite 构建
npm run tauri build  # 打包安装包
```

## 连接 AstrBot

1. 在服务端 AstrBot 安装配套插件 [astrbot-plugin-plus](https://github.com/icenfn/astrbot-plugin-plus)
   （默认端口 `6199`），并在 WebUI「机器人 → 创建机器人」中启用 AstrBot+ 平台。
2. 应用内「设置 → 连接」填入插件地址（如 `http://<服务器IP>:6199`，也支持
   `host:6199` 或 `ws://…` 写法），无需密钥。
3. 连接成功后自动加载 Agent 列表。

## 目录约定

- `src/api` — 仅放与 AstrBot API 的通信与类型，不写 UI 逻辑。
- `src/stores` — Pinia store，承载业务状态。
- `src/composables` — 与平台能力（通知 / 窗口 / 托盘）交互的可复用逻辑。
- `src/components`、`src/views` — 展示层。

## 发布（Release）

推送 `v*` 标签或手动触发 `.github/workflows/release.yml` 即会构建三端并创建
GitHub Release。版本号与发布说明取自 `CHANGELOG.md` 的第一条 `## ` 记录，因此发版前
请先更新它。

## Android

移动端打包与签名见 [`MOBILE.md`](./MOBILE.md)。核心命令：

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
export ANDROID_HOME=... NDK_HOME=...
npm run android:init     # 生成 src-tauri/gen/android
npm run android:build:apk
```

## 图标

仓库根部的 `app-icon.png` 是应用图标的唯一标准来源。修改品牌图标后运行：

```bash
pip install pillow cairosvg
python3 scripts/gen_icons.py
```

它会从 `app-icon.png` 满幅生成 `src-tauri/icons/` 下的全部图标（Android legacy
方形/圆形、自适应前景/背景、桌面 32/128/256/512 + icns/ico）。**不要**使用
`npx tauri icon`（会引入不一致的边距与自适应前景）。

## 代码风格

- TypeScript strict 模式。
- Vue 使用 `<script setup lang="ts">` + 组合式 API。
- 提交前请运行 `npm run build` 确保类型检查通过。
