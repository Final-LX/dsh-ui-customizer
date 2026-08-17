# DSH 桌面客户端

用 Electron 把 DSH 的浏览器界面包成独立原生窗口，配合 [`dsh-ui-customizer`](../README.md) 主题插件使用。

- **macOS 风格红绿灯标题栏**：左上角红/黄/绿三个按钮，背景边框跟随 DIY 主题，无多余文字。
- **与网页端共享实例**：端口统一 3080，会话实时同步、不并发写会话日志。
- **托盘常驻**：渐变图标，关窗最小化到托盘，不占用任务栏。
- **自包含、首启离线**：harness、pnpm、主题插件全部随包内置，全新机器无需 Node/pnpm/git、也无需联网即可启动。
- **日志落盘 + 崩溃恢复**。

## 下载安装

- 最新安装包：<https://github.com/Final-LX/dsh-ui-customizer/releases/latest>
- 全部版本：<https://github.com/Final-LX/dsh-ui-customizer/releases>

双击安装（未签名，SmartScreen 提示「仍要运行」）。装完启动即可。

## 运行（开发模式）

```powershell
cd desktop
pnpm install   # 安装 Electron（首次下载 ~190MB 二进制）
pnpm start
```

## 工作原理

### 启动 DSH 的运行器（三级回退）

1. 打包内嵌了 `@deepseek-ai/dsh` → 用 Electron 内嵌 Node（`ELECTRON_RUN_AS_NODE=1`）跑 `bin.js`；
2. 本机 npx 缓存里有 `@deepseek-ai/dsh` → 用**系统 `node.exe` 直接跑 `bin.js`**（`shell:false`，避开 Electron 下 npx/cmd/shell 的 stdio 捕获问题——这是之前「启动超时」的根因）；
3. 兜底回退 `npx`。

### 端口 3080 共享（关键）

端口固定为 **3080**，与官方 `dsh web` 一致。桌面端启动时会先探测 3080 上是否已有 DSH 实例：

- **有** → 直接复用（`ownsServer = false`），不重复起服务；退出时**不杀**这个共享实例，避免误伤网页端正在用的会话。
- **没有** → 自己起一个（`ownsServer = true`），退出时回收。

好处：网页端和桌面端是同一个 DSH 进程，**会话实时同步**；也不会两个进程并发写同一份会话日志导致 `corrupt Zstandard session log`。

### 窗口标题栏（红绿灯）

窗口 `frame: false`（无系统标题栏），`dom-ready` 时注入一条 36px 标题栏：

- 左上角红绿灯：红 `#ff5f57`（关闭）、黄 `#febc2e`（最小化）、绿 `#28c840`（最大化），12px 圆点，悬停显示 `× / − / +`。
- 背景 `var(--dsw-alias-bg-base)`、底边 `var(--dsw-alias-border-l1)`——**跟随 DIY 主题**自动变色。
- 内容区 `padding-top: 36px + overflow: hidden` 让位，侧边栏全高显示、无滚动条。

### 托盘

托盘图标是品牌蓝→强调紫渐变的**多尺寸 ICO**（`assets/icon.ico`，16/24/32/48/256）。关窗默认最小化到托盘（不退出），托盘菜单「退出」才真正结束。

## API key（与官方一致）

桌面壳**不自动填 key、也不代管密钥**，行为和官方 `dsh web` 完全一致：

- 新用户首次打开窗口进入 DSH 自带「填 API key」引导（设置 → Models）；
- 或走官方环境变量 `DEEPSEEK_API_KEY`（自定义网关再加 `DEEPSEEK_BASE_URL`），桌面壳 spawn DSH 时继承当前环境变量。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `DSH_PROFILE` | `web` | 用哪个 DSH profile（web 模板自带 web-app） |
| `DSH_PORT` | `3080` | 与网页端共享的端口；改端口会导致会话不再同步 |
| `DSH_HOME` | `~/.dsh` | DSH 数据目录（profile、日志也在此） |
| `DSH_WEB_UI` | 未设 | 设为 `1` 时首次引导额外安装 `@linxin666/dsh-web-ui-all` 全家桶 |

## 数据都在哪

- **服务端** `~/.dsh/`：profile、插件、会话、日志 `desktop.log`。
- **浏览器端**（Electron `userData`，Windows 在 `%APPDATA%/dsh-ui-desktop/`）：localStorage（DIY 配置、方案）+ IndexedDB（上传的图片/视频）。

> 注意：浏览器端数据按 origin 隔离，且网页浏览器和 Electron 是**不同的浏览器 profile**——所以 DIY 主题配置在网页端和桌面端是各自独立保存的（会话是同步的，主题配置不共享）。

## 打包分发

```powershell
pnpm pack              # 仅生成未打包目录 dist\win-unpacked（便携版，直接跑 DSH.exe）
pnpm dist              # 生成 Windows NSIS 安装包 dist\DSH Setup 0.1.5.exe
```

已内置的打包坑位规避（`package.json` build 字段）：

- `electronDist: node_modules/electron/dist`：复用本地 Electron 二进制，避免从 GitHub 下载 115MB zip（此网络下易损坏）。
- `win.signAndEditExecutable: false`：跳过 winCodeSign 的 rcedit/签名——非管理员、未开「开发者模式」时 winCodeSign 解包里的 macOS 符号链接会报「无法创建符号链接」。exe 图标改由 `afterPack`（`scripts/after-pack.cjs`）用 rcedit 单独写入，不依赖 winCodeSign。

### 自包含打包（关键）

安装包把整套 DSH 运行时都打了进去，目标机器**不需要装 Node / pnpm / git，首启也不需要联网**：

- `@deepseek-ai/dsh`（完整 harness，含 dsh-base + dsh-web-app 等 bundle）随包内置；
- `pnpm@9` 随包内置（Electron 内嵌 Node 跑 `pnpm.cjs`），仅「可选 `DSH_WEB_UI=1` 全家桶」那条路才会用到；
- `dsh-ui-customizer` 主题插件随包内置（`file:` 依赖直接进 harness 的 node_modules），loader 直接从安装侧解析，**不再往 profile 里 `pnpm add`**——这就是首启离线的根本原因；
- `node-addon-require-builtin-win32-x64-msvc` 作为直接依赖提升到顶层：electron-builder 会把 pnpm 铺成嵌套布局，导致这个平台二进制被塞进 `node-addon-require-builtin/` 里、原生内部加载器找不到 → DSH 必装的 HMR 报 `--expose-internals is required`。升到顶层后原生加载器恢复，HMR 与外置插件解析都正常。

> 注意：上面第 4 条目前只加了 Windows 的 `win32-x64-msvc` 变体。以后要出 macOS / Linux 安装包，需照同样方式把对应平台变体（`-darwin-arm64`、`-darwin-x64`、`-linux-x64-gnu` 等）加为直接依赖。

发 GitHub Release 上传 exe 即可；`latest` 永远指向最新版。

## 已知限制

- **未签名**：SmartScreen 会提示，点「仍要运行」。
- **可选全家桶需要联网**：默认首启离线；只有设 `DSH_WEB_UI=1` 时才会用内置 pnpm 联网装 `@linxin666/dsh-web-ui-all`。
- **pnpm 11 拦 electron postinstall**：仓库带 `desktop/pnpm-workspace.yaml`（`allowBuilds: electron: true`），若 `pnpm install` 报 `ERR_PNPM_IGNORED_BUILDS`，跑 `pnpm rebuild electron`。
- 安全边界：`contextIsolation`/`sandbox`/`webSecurity` 全开，仅通过 `preload.js` 暴露最小窗口控制 IPC。
