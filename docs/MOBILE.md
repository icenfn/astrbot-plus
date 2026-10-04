# 多端（桌面 / Android）说明

AstrBot+ 使用 Tauri 2，同一套 Vue 前端 + Rust 后端可同时构建桌面端与移动端。

## 平台能力差异

| 能力 | 桌面 | Android |
| --- | --- | --- |
| 纯文字单聊 / 群聊 | ✅ | ✅ |
| 会话列表 / 历史 | ✅ | ✅ |
| 系统通知 | ✅（通知中心） | ✅（Android 通知） |
| HTTP 访问自建 AstrBot | ✅ | ✅（需允许明文 HTTP，见下） |
| 系统托盘 | ✅ | ❌（移动端无托盘） |
| 关闭窗口驻留后台 | ✅ | ❌ |
| 开机自启 | ✅ | ❌（Android 由系统管理） |

仅桌面可用的代码通过 `#[cfg(desktop)]` 隔离：

- `src-tauri/src/lib.rs`：托盘、`CloseRequested` 隐藏窗口、`autostart` 插件。
- `src-tauri/Cargo.toml`：`tauri-plugin-autostart` 只在 desktop target 下依赖。
- 前端 `src/composables/useWindow.ts` 全部调用都先判断 `isTauri()`，且托盘/自启
  相关按钮在设置页会提示「仅在桌面端生效」。

## 权限（capabilities）

Tauri 2 按平台拆分权限文件：

- `capabilities/default.json` — `platforms: ["linux","macOS","windows"]`，
  额外包含窗口显示/隐藏/最小化、`autostart:default`。
- `capabilities/mobile.json` — `platforms: ["android","iOS"]`，仅保留
  `core:default`、`opener`、`notification`、`http`。

两者都允许 `http(s)://*`，以便访问用户自架的 AstrBot。

## Android 明文 HTTP（重要）

AstrBot 默认监听 `http://`（非 https）。Android 9+ 默认禁止明文流量，需要在生成的
Android 工程中允许 cleartext。`npm run android:init` 生成 `src-tauri/gen/android`
后，编辑 `app/src/main/AndroidManifest.xml` 的 `<application>` 标签，加入：

```xml
<application
    android:usesCleartextTraffic="true"
    ... >
```

> 仅当你的 AstrBot 使用 http 时才需要；若使用 https 可忽略。

## 图标

移动端图标同样来自 `src-tauri/icons`（由 `public/logo.svg` 经 `npx tauri icon`
生成）。重新生成：

```bash
inkscape public/logo.svg --export-type=png --export-filename=logo-master.png -w 1024 -h 1024
npx tauri icon logo-master.png
```

## 构建命令速查

```bash
npm run android:init        # 生成原生工程
npm run android:dev         # 真机/模拟器调试
npm run android:build:apk   # 打 APK
npm run android:build:aab   # 打 AAB（上架 Google Play）
```

更多细节见 Tauri 官方移动端文档：<https://tauri.app/start/migrate/from-tauri-1/>
与 <https://tauri.app/develop/>。
