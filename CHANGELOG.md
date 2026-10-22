## v0.9.0

### 重构
- 🏗️ **重构为基于 alovajs + Socket.IO 的 IM 客户端**：客户端主动查询（登录、拉 Agent / 用户列表、拉历史消息）统一走 HTTP API，服务端主动推送的实时事件（消息发送、流式回复、私聊到达）走 Socket.IO；UI 风格保持不变。

### 新增
- 🔗 **快连链接向导**：新增向导第一步为快连链接 `ap://email:password@(ip||domain:port)`，本地解析出服务端地址、邮箱与密码并按与手动录入完全一致的存储方式落盘；解析并登录成功后直接跳过手动录入服务端地址与邮箱密码的步骤。
- 👥 **联系人与用户私聊**：联系人页分为「智能体」与「好友」两个分组，好友来自 `GET /api/users`，点击即可像与 Agent 对话一样发起用户间私聊。
- 🔐 **JWT 鉴权**：登录成功后保存服务端下发的一次性 Token，HTTP API 通过 `Authorization: Bearer` 自动注入，Socket.IO 以 `auth: { token }` 完成长连接鉴权；token 失效时统一返回并回到凭据步骤修正。
- 🗂️ **用户与 Agent 会话隔离**：每次打开 Agent 会话使用独立会话键，不同用户的 Agent 对话互不可见；用户私聊消息由服务端落库，支持消息漫游。
- ⏱️ **私聊实时链路**：`private:send` 发送并按 `reqId` 关联服务端回显（乐观更新），`private:message` 接收对端推送。

### 适配服务端插件 0.9.0
- 🏷️ **Agent 备注字段**：`/api/agents` 与 `bots:list` 新增可选的 `remark` 字段，客户端 `AgentRow` 类型同步补充，Agent 详情页在显示名下方展示备注（无备注不占位）。
- 🔐 **Token 失效统一回收凭据**：HTTP 层捕获 `401` 时清除本地已存 Token 并提示重新登录，避免携带失效 Token 反复请求失败；与插件新增的 `token_expire_days`（默认 30 天、`0` 为永久）配置配套生效。

### 修复
- 🔢 **版本号统一为 0.9.0**：`package.json`、`package-lock.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 四处版本号保持一致，此前仍停留在 0.4.28。

### 说明
- 🔖 版本号提升至 `0.9.0`，配合服务端插件 [astrbot-plugin-plus](https://github.com/icenfn/astrbot-plugin-plus) `0.9.0`。

## v0.4.28

### 修复
- 🎛️ **v-switch 真正取到主题色（淡蓝问题根治）**
  根因不在配色表：Vuetify 4.2.3 的 `VSwitch.css` 里 `.v-switch__track` 硬编码了 `opacity: 0.6`，选中态只是额外叠一个 `.bg-primary` 工具类，于是 `#5b9dff` 被 60% 透明度「洗」成淡蓝（叠在 `#151f33` 上约等于 `#3c6baf`）。改 `primary` 颜色值永远治不好。
  现在在 `main.scss` 覆写为：轨道 `opacity: 1`、选中态直接 `background-color: rgb(var(--v-theme-primary))`、开关滑块改为白底 + 主色图标、关态用中性灰且不再叠透明度、禁用态单独降级。规则不再依赖 `utilities` 与 `components` 的层序，新旧 WebView 一致。
- 📐 **设置 / 向导页 v-select 回到 title、subtitle 右侧**
  上一版为保证窄屏不被挤压，把 `v-select` 拆成独占整行（标题在上、选择器在下），视觉上像「掉下去的一行」。现改为放进 `v-list-item` 的右侧 `#append` 槽：标题/副标题在左自适应换行，选择器固定在右侧 132px（`max-width: 44vw` 兜住窄屏），并压掉 `solo-filled` 的内部纵向留白让整行高度稳定、垂直居中。
- 🎨 **v-btn 样式统一**
  `main.scss` 建立按钮基线：统一 `font-weight: 600` / `letter-spacing: 0` / `text-transform: none`（中文下 Vuetify 默认字距偏松）；所有图标按钮统一为圆形；裸文字图标按钮统一加 `on-surface` 7% 淡底，不再像「悬浮的一个图标」；实心主按钮统一 `border-radius: 12px` + `min-height: 44px`。消息页顶栏按钮、回到底部按钮、Agent 信息页「发消息」现在同属一套视觉语言。
- 💬 **聊天页发送区重做**
  原来发送按钮是 36px 图标，而输入框是 38px 白底 + 阴影，两者高度和质感都对不上。现在：输入框改为**主题化**的 `surface-variant` 填充 + 描边（浅色主题下不再白底白边看不见边界），高度固定 44px，聚焦时描边转为主色；发送按钮改为 44×44 圆形主色，与输入框**等高同圆角族**，并带主色柔和投影；「整页编辑」按钮缩到 22px 并贴到输入框内侧右上角，不再遮挡首行文字。

### 验证
- `vue-tsc --noEmit` 0 错误；`vite build` 45.36s 通过。
- 产物核对：`.v-switch .v-switch__track{opacity:1}`、`.v-switch .v-selection-control--dirty .v-switch__track{background-color:rgb(var(--v-theme-primary))}`、`.v-btn--icon{border-radius:50%}` 均存在于 `assets/index-*.css`；`@layer` 计数仍为 0（兼容层未回退）。

## v0.4.27

### 修复
- 🛠️ **修复 Windows / 桌面端构建中断（NSIS 打包前就失败）**：`v0.4.26` 的 CI 在 `Build Windows installer (nsis)` 步骤长时间无输出后被取消，根因是前端构建阶段抛出了三条配置级错误，`vite build` 直接失败。三处均已修正：
  1. **`plugin-legacy overrode 'build.target'`** — `@vitejs/plugin-legacy` 在生成 legacy 包时会**强制覆盖** `build.target`，`vite.config.ts` 里再手写一份既不生效又触发告警。现在删除 `build.target`，统一交给插件按 `browserslist` / 内置目标推导。
  2. **`plugin-legacy 'modernTargets' option overrode the builtin targets`** — 显式传 `modernTargets` 会覆盖插件内置的 modern 目标（`es2020 / edge79 / firefox67 / chrome64 / safari12`），并让中间版本区间出现支持缺口。现在移除该选项：插件内置目标本就低于 WebView 91（≈Chrome 91）底线，覆盖已足够。
  3. **`Unknown feature: "color-mix-function"`** — `postcss-preset-env` 10.x 的 cssdb feature id 已从 `color-mix-function` 改为 `color-mix`，旧名字会直接抛错中断构建。现已改用正确 id，并一并关闭变参形态 `color-mix-variadic-function-arguments`，保证所有 `color-mix()` 只由本地叠加式降级插件处理。

### 说明
- 📦 行为不变：仍是「polyfills / PostCSS 只降级、不污染现代浏览器」的叠加式策略；现代浏览器继续使用原生 `color-mix()` 与 `@layer` 语义（构建产物中 `@layer` 计数 0、`@supports` 块外 `color-mix()` 计数 0）。
- 🔖 版本号提升至 `0.4.27`；`0.4.26` 因 Windows 安装包缺失，由本版补齐双端产物。

## v0.4.26

### 修复（重点）
- 🎨 **彻底修复 v-chip / v-switch / v-btn 不跟随主题色**（新旧 WebView 均已修复）。
  真正原因不是 `primary` 没设成蓝色（它一直是蓝色），也不是 polyfills / PostCSS 把颜色弄丢，而是 **CSS 级联层（`@layer`）不对称**：
  Vuetify 4 把样式组织在级联层里。本项目需要兼容 Android WebView 91，构建期 PostCSS 会把**静态**组件 CSS 的 `@layer` 全部展平为「无层级」规则；而 Vuetify 在**运行时**注入的主题工具类（`.bg-primary` 等）仍包在 `@layer vuetify-utilities` 内。按 CSS 规范，**未分层规则优先于一切分层规则**，因此 `.v-btn--variant-flat { background: rgb(var(--v-theme-surface)) }` 永远压过 `.bg-primary`。
  现在新增运行期级联顺序兼容层（`src/compat/legacy-css.ts`）：对所有引擎把运行时主题表一并去层，并置于 `<head>` 末尾，复刻 Vuetify 原本「utilities 最后」的层序语义 —— 新旧 WebView 表现一致。
- 📐 **`@layer` 之外的现代 CSS 改为「叠加式」降级**：`dvh` / `color-mix()` / `oklch()` 等先把兼容写法插在原声明**之前**，原生值原样保留。现代浏览器继续走原生语法（后出现的声明胜出），只有不支持的老引擎才回落到兼容声明 —— 降级存在，但不改变现代浏览器的行为。
- 🩹 补齐 `@supports` 之外的 `color-mix()` 兜底（约 10 处，主要在 v-switch 轨道），修复 WebView 91 下开关轨道没有背景的问题。

### 变更（可维护性）
- 🧩 **正式采用 Vuetify Theme + Global configuration 统一管理 UI**
  - 新增 `src/plugins/theme.ts` 作为**唯一配色来源**：集中定义 `THEME_NAMES`、暗色/亮色两套色板与 theme variables；`vuetify.ts` 退回为「只负责装配」。
  - 组件默认 props 全部收敛到 `defaults`（VBtn / VSwitch / VChip / VTextField / VSelect / VTextarea / VCard / VList / VListItem / VDialog …），页面不再逐个重复写 `color`、`rounded`、`density`。
  - 主题名不再以字符串散落各处：`settings.ts` 的 `ThemeMode` 收敛为 `system | dark | light`，并自动迁移旧的 `astrbotDark/Light`、`telegramDark/Light` 存储值。
- 🌙 **暗色主题重做**：改为「三层景深」—— `background`（最深）→ `surface`（面板）→ `surface-bright`（悬浮），不再是一片同色糊在一起；`primary` 提亮为 `#5b9dff`（在深色底上对比约 4.6:1），主色之上的文字改用深蓝 `on-primary`，避免「白字发光」；语义色统一到 Material 调色板。
- ☀️ 亮色主题同步整理：浅灰蓝页面底 + 纯白面板，形成「白卡片浮在浅底上」的层次。

### 消息列表
- 🗂️ **只有「有往来」的会话才出现在消息列表**：除非服务端已有历史消息（插件新增 `historyCount`），或用户从「联系人 → Agent 信息」点击「发消息」开启了会话，否则不会凭空占位。该状态持久化在本地 SQLite（`conversations` 表），重启后保留。
- 🔤 会话行排版与头像对齐：标题 16px / 副标题 13.5px（原 15px / 13px 偏小，与 48px 头像不匹配），文字与头像间距加大到 14px。

### 设置 / 向导
- 📏 **彻底解决 `v-select` 在窄屏被挤压**：不再把选择器塞进 `v-list-item` 的 `append` 槽与标题争抢宽度，改为独占整行（`width: 100%`），窄屏下不可能被截断。
- ✂️ 设置项说明文案统一精简（「跟随系统会随系统深浅色切换」「后台保持连接并接收消息」「最小化时隐藏到托盘」等），做到言简意赅。

### 聊天页
- ➡️ **发送按钮移到编辑框右侧**，不再占用输入区宽度；多行草稿有更多可用横宽。
- 📌 「整页编辑」按钮改为贴住编辑框最右侧（原被发送按钮挤到 `right: 40px`）。

### Agent 信息页 / 联系人页
- 🧹 Agent 信息页移除「启用状态」「平台适配器」「服务端信息」（插件名 / 版本 / 端口）及相关代码，「Agent 配置」标题改为「配置」。插件端 `bots:list` 同步不再下发 `platform` / `enabled`，客户端也删除了对应的 `PluginConfig` 类型与 `getConfig()` 调用。
- 🔢 联系人页去掉「智能体」分组计数。
- ↔️ 联系人列表标题与左侧头像间距加大到 14px，标题 16px。

### 兼容层（保留，未删）
- 🧱 `@vitejs/plugin-legacy` + core-js polyfill 清单、PostCSS 降级链路 **完整保留**。JS polyfill 本身只在特性探测失败时才打补丁，现代浏览器不会执行；CSS 降级已如上改为叠加式，不污染现代浏览器。

## v0.4.25

### 新增
- 📌 **消息列表改为真正的「会话列表」**：不再直接照搬机器人目录，而是按「置顶优先 → 最近活跃」排序的会话流，每行显示 Agent 头像、名称、最近一条消息与时间，微信式排布。
- 🔢 **未读角标改为数字计数**：红色角标显示 1~99，超过 99 显示 `99+`，取代原来只能表达「有/无」的圆点。
- 📌 **长按会话可置顶**：长按弹出菜单支持置顶 / 取消置顶，置顶状态持久化到本地 SQLite，重启后保留。
- 🗑️ **长按会话可删除（含二次确认）**：确认后同时清除本地 SQLite 缓存、内存会话与服务端历史，并广播给其它客户端同步移除该会话；服务端不可达时本地删除照常生效。

### 变更
- 🧹 **删除「设为未读」菜单项**：该功能语义含糊且与真实未读统计冲突，已移除，仅保留「置顶 / 删除」。
- 👤 **Agent 详情页合并升级**：`/agent/:id` 现同时承担「联系人详情」与「Agent 配置」两个角色，新增 **发消息** 主按钮直达会话，并展示 Bot ID、平台适配器、启用状态与插件服务端信息（插件名 / 版本 / 端口）。
- 🏷️ **Agent 显示名统一为 `botname`**：与插件端字段对齐；详情页同时展示机器人指纹 `botdf`。

### 性能 / 体积
- 📦 **应用体积显著下降（dist 12 MB → 8.7 MB，约 -27%）**：MDI 图标字体由四种格式（eot/ttf/woff/woff2，共约 3.6 MB）精简为 **仅 woff2（约 394 KB）**，图标类名与用法完全不变。

### 修复
- 🔌 **移除未使用的 `@tauri-apps/plugin-http`**：前端全程走 Socket.io（原生 XHR），该 Tauri 插件从未被调用，已从依赖、Cargo 与能力清单中删除，减少二进制体积与攻击面。
- 📌 **保留 `@vue/devtools-api` 为显式依赖**：它是 `pinia@4` 的 peerDependency 且被其发行版直接 `import`，属构建/运行期硬依赖；此前按「冗余包」移除会导致 CI 全新安装后 `vite build` 报 `Rollup failed to resolve import "@vue/devtools-api"`，现已恢复声明。真正移除的冗余包为未使用的 `alova`。

### 说明
- 🔖 版本号提升至 `0.4.25`（`package.json` / `Cargo.toml` / `tauri.conf.json` 同步），配套插件 `0.4.9`。
- 🧩 **老旧 Android WebView（>90）兼容层完整保留**：`@vitejs/plugin-legacy`、core-js polyfill 清单与 PostCSS 降级插件均未改动；v-chip / v-switch / v-btn 跟随主题色仍由 Vuetify `defaults` 中的 `color` 默认值实现，与本轮体积优化互不影响。

## v0.4.24

### 修复
- 💬 **聊天页对方消息气泡改为白色**：无论深浅色主题，对方（Agent）消息气泡统一为白底深字。
- ⏳ **修复发送按钮偶发一直转圈**：未连接时不再发起发送；补充 45s 兜底看门狗，避免 `chat:done` 丢失导致输入框卡死。
- 🔘 **修复设置/向导中 v-switch 不跟随主题色**：为全局 switch 指定主题强调色。
- 📏 **修复页面边距截断组件**：设置页与向导页放宽留白并允许溢出，开关/下拉不再被裁切。
- 🧭 **修复向导返回键**：第一步输入框高度固定，编辑时不再跳动；返回键逐级回到上一步（含安卓物理返回键）。

### 变更
- ✍️ **输入框重做**：支持多行自动增高、整页展开编辑；整体缩小底栏高度与输入框尺寸；移动端仅通过发送按钮发送（回车换行），桌面端保持回车发送。
- 🗂️ **重写本地消息缓存与读取**：会话消息"本地优先"渲染，服务端历史**仅在首次完整抓取一次**，之后完全由本地缓存驱动，离线可读、无空白闪烁。
- 👥 **联系人页**：分组图标由 emoji 改为 MDI 图标；「智能体」分组改为展示从插件服务端拉取的机器人列表；列表/分组样式与整体 UI 统一。
- 📋 **消息列表**：新增红色未读圆点；长按弹出「置顶消息 / 设为未读 / 删除消息」菜单（占位，暂未实现实际功能）；删除进度条占位；移除底部「消息」标签右上角的新消息数量角标；列表样式与整体 UI 统一。
- 🔔 **通知方式**下拉精简为「始终提醒 / 仅后台」。
- 📱 **安卓后台运行/通知**：新增真正的前台服务（`BackgroundService`）并接入桥接与清单，后台保持连接与接收消息；关闭「后台运行」即停止服务；权限仍按需申请，不在启动时弹窗。
- 🧩 **插件服务端精简**：移除历史的磁盘持久化（改内存环形缓冲，历史由客户端缓存）；删除冗余 `ping` 事件（Socket.io 自带心跳）；内联冗余包装函数、清理无用导入。
- 🔖 版本号提升至 `0.4.24`（插件 0.4.8）。

