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

1. 在 AstrBot 控制台创建 API Key（含 chat / im 等 scope）。
2. 应用内「设置」填入服务器地址（如 `http://localhost:6185`）与 API Key。
3. 点击「测试连接」，成功后会自动加载会话列表。

## 目录约定

- `src/api` — 仅放与 AstrBot API 的通信与类型，不写 UI 逻辑。
- `src/stores` — Pinia store，承载业务状态。
- `src/composables` — 与平台能力（通知 / 窗口 / 托盘）交互的可复用逻辑。
- `src/components`、`src/views` — 展示层。

## 图标

新增或修改品牌图标时：

```bash
# 1. 编辑 public/logo.svg
# 2. 生成 1024 主图（示例用 inkscape）
inkscape public/logo.svg --export-type=png --export-filename=logo-master.png -w 1024 -h 1024
# 3. 生成各平台图标
npx tauri icon logo-master.png
```

## 代码风格

- TypeScript strict 模式。
- Vue 使用 `<script setup lang="ts">` + 组合式 API。
- 提交前请运行 `npm run build` 确保类型检查通过。
