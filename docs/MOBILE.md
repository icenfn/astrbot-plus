# 多端（桌面 / Android）说明

AstrBot+ 使用 Tauri 2，同一套 Vue 前端 + Rust 后端可同时构建桌面端与移动端。
移动端在窄屏（≤ 900px）下自动切换布局：**底部 Tab 栏 + 单栏聊天**。

## 平台能力差异

| 能力 | 桌面 | Android |
| --- | --- | --- |
| 纯文字单聊 / 群聊 | ✅ | ✅ |
| 会话列表 / 历史 | ✅ | ✅ |
| 系统通知 | ✅（通知中心） | ✅（Android 通知） |
| HTTP 访问自建 AstrBot | ✅ | ✅（需允许明文 HTTP，见下） |
| 侧边栏导航 | ✅（左侧 rail） | ❌ → 底部 Tab 栏 |
| 系统托盘 | ✅ | ❌ |
| 关闭窗口驻留后台 | ✅ | ❌ |
| 开机自启 | ✅ | ❌ |
| 系统返回键 | — | ✅（`android:back` 事件，见下） |
| 系统栏安全区 | — | ✅（MainActivity inset 适配） |

仅桌面可用的 Rust 代码通过 `#[cfg(desktop)]` 隔离（`src-tauri/src/lib.rs`）；
`tauri-plugin-autostart` 也只在桌面 target 下依赖。前端布局差异由
`src/composables/usePlatform.ts`（`useMediaQuery("(max-width: 900px)")`）驱动。

## 移动端布局（底部 Tab）

- `src/components/AppMobileNav.vue`：底部 Tab（聊天 / 会话 / 设置）。
- `src/App.vue`：窄屏时隐藏左侧 `AppSidebar`，改为在底部渲染 `AppMobileNav`，
  并监听 `android:back` 事件。
- `src/views/ChatView.vue`：窄屏时单栏切换（列表 ⇄ 会话）。
- `src/components/ChatWindow.vue`：窄屏时标题栏显示返回按钮。

## 权限（capabilities）

- `capabilities/default.json` — `platforms: ["linux","macOS","windows"]`，含窗口/托盘/自启。
- `capabilities/mobile.json` — `platforms: ["android","iOS"]`，仅 `core` / `opener` /
  `notification` / `http`。

两者都允许 `http(s)://*`，以便访问用户自架的 AstrBot。

## Android 明文 HTTP（重要）

AstrBot 默认监听 `http://`（非 https），Android 9+ 默认禁止明文流量。CI 构建时会自动为
`AndroidManifest.xml` 打补丁加入 `android:usesCleartextTraffic="true"`。本地构建可手动编辑
`src-tauri/gen/android/app/src/main/AndroidManifest.xml`。

## 应用图标

图标由 `scripts/gen_icons.py` 统一生成（`python3 scripts/gen_icons.py`），**不要**再用
`npx tauri icon`——它会把素材按满幅渲染，使桌面与 Android 图标看起来被放大/裁剪，
并会重建 Android 自适应图标（前景占满 108dp 画布，被系统蒙版放大）。生成脚本会：

- 桌面端：把 `public/logo.svg` 缩放到约 84% 后居中，四周留出透明边距；
- Android 自适应图标：全幅渐变背景层 + 位于安全区（约 58%）内的透明前景层；
- Android 旧版（≤ 7.1）：方形与圆形启动图标。

`tauri android init` 会用模板默认图标覆盖 `app/src/main/res/`，因此构建流程中会执行：

```bash
cp -r src-tauri/icons/android/. src-tauri/gen/android/app/src/main/res/
```

这就是 APK 图标之前显示为 Tauri 默认图标的原因——现已修复。

## Android 签名

APK 必须签名才能安装。本项目采用「有正式密钥用正式密钥，否则用内置稳定 debug 签名」的策略：

- 默认：仓库内置 `android/debug.keystore`（alias `astrbotplus`，口令 `android`）。
  它被提交进版本库，保证**每次构建使用同一密钥**，避免覆盖安装时报“软件包冲突”。
- 正式：配置以下 Secrets 后，CI 自动改用正式签名：

  | Secret | 说明 |
  | --- | --- |
  | `ANDROID_KEY_BASE64` | keystore 的 base64（`base64 -w0 release.keystore`） |
  | `ANDROID_KEY_ALIAS` | 别名 |
  | `ANDROID_KEY_PASSWORD` | 口令 |

CI 会写出 `src-tauri/gen/android/keystore.properties`，并向 `app/build.gradle.kts`
注入 `signingConfigs { release }` 与 `signingConfig`，再执行
`tauri android build --apk --split-per-abi`。

生成自己的 keystore：

```bash
keytool -genkeypair -v -keystore release.keystore -storepass 你的口令 -keypass 你的口令 \
  -alias astrbot-plus -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=AstrBot Plus, OU=Dev, O=AstrBotPlus, C=CN"
base64 -w0 release.keystore   # 填入 ANDROID_KEY_BASE64
```

## 构建命令速查

```bash
npm run android:init        # 生成原生工程
npm run android:dev         # 真机 / 模拟器调试
npm run android:build:apk   # 打 APK
npm run android:build:aab   # 打 AAB（上架 Google Play）
```

## 云端构建与发布

推送 `v*` 标签或手动触发 `.github/workflows/release.yml`，会：
1. 从 `CHANGELOG.md` 读取版本号与发布说明；
2. 并行构建 Linux（deb/rpm）、Windows（NSIS）、Android（arm64+armv7，已签名）；
3. 汇总为一次 GitHub Release 并上传全部产物。

更多细节见 Tauri 官方移动端文档：<https://tauri.app/develop/>。
