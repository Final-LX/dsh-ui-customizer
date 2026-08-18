# DSH 桌面客户端

用 Electron 把 DSH 的浏览器界面包成独立原生窗口，配合 [`dsh-ui-customizer`](../README.md) 主题插件使用。

- **向导式安装**：安装包带「欢迎 → 安装 → 完成」向导页，进度清晰，装完可选「运行 DSH」。
- **启动画面**：首次启动先显示「正在启动」等待画面，DSH 就绪后自动进入主界面。
- **macOS 风格红绿灯标题栏**：左上角红/黄/绿三个按钮，背景边框跟随 DIY 主题，无多余文字。
- **与网页端共享实例**：端口统一 3080，会话实时同步、不并发写会话日志。
- **托盘常驻**：渐变图标，关窗最小化到托盘，不占用任务栏。
- **自包含、首启离线**：整套 DSH 运行时与主题插件随包内置，全新机器无需 Node/pnpm/git、也无需联网即可启动。
- **日志落盘 + 崩溃恢复**。

## 下载安装

### 安装包文件说明

| 文件 | 说明 |
|---|---|
| `DSH-Setup-<版本>.exe` | Windows 安装程序，双击运行安装向导，装完生成桌面/开始菜单「DSH」快捷方式 |
| `DSH-Setup-<版本>.exe.blockmap` | 增量更新用的块映射文件，自动更新时用，普通安装无需理会 |
| `latest.yml` | 自动更新元数据（版本号 + sha512 校验值） |

### 安装步骤

1. 打开 <https://github.com/Final-LX/dsh-ui-customizer/releases/latest>，下载 `DSH-Setup-<版本>.exe`；
2. 双击运行，在安装向导里点「安装」（可改安装目录）；
3. 未签名程序，SmartScreen 会提示，点「仍要运行」；
4. 装完勾选「运行 DSH」直接启动，或从桌面/开始菜单的「DSH」快捷方式启动。

## 使用

1. 启动「DSH」后，首次会进入 DSH 自带的「填 API key」引导（和官方 `dsh web` 一致，桌面端不代填）；
2. 进入主界面后，右上角「设置」→ 左侧「DIY 主题」即可定制主题；
3. 关窗口默认最小化到托盘（不退出），托盘图标右键可「退出」。

## 常见问题

- **SmartScreen 提示？** 点「更多信息」→「仍要运行」，未签名程序的正常提示。
- **和网页版数据同步吗？** 会话（聊天记录）同步——共用 3080 端口和同一个 DSH 实例；主题配置各自独立（存在浏览器本地）。
- **启动要等多久？** 约 2 秒会先显示「正在启动」画面，DSH 就绪后自动进入主界面。

## API key（与官方一致）

桌面壳**不自动填 key、也不代管密钥**，行为和官方 `dsh web` 完全一致：

- 新用户首次打开窗口进入 DSH 自带「填 API key」引导（设置 → Models）；
- 或走官方环境变量 `DEEPSEEK_API_KEY`（自定义网关再加 `DEEPSEEK_BASE_URL`），桌面壳 spawn DSH 时继承当前环境变量。

## 数据都在哪

- **服务端** `~/.dsh/`：profile（含 `cordis.patch.yml` 里的 loader 登记）、会话、日志 `desktop.log`。主题插件本身随包内置在安装目录，不在 `~/.dsh`。
- **浏览器端**（Electron `userData`，Windows 在 `%APPDATA%/dsh-ui-desktop/`）：localStorage（DIY 配置、方案）+ IndexedDB（上传的图片/视频）。

> 注意：浏览器端数据按 origin 隔离，且网页浏览器和 Electron 是**不同的浏览器 profile**——所以 DIY 主题配置在网页端和桌面端是各自独立保存的（会话是同步的，主题配置不共享）。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `DSH_PROFILE` | `web` | 用哪个 DSH profile（web 模板自带 web-app） |
| `DSH_PORT` | `3080` | 与网页端共享的端口；改端口会导致会话不再同步 |
| `DSH_HOME` | `~/.dsh` | DSH 数据目录（profile、日志也在此） |

## 已知限制

- **未签名**：SmartScreen 会提示，点「仍要运行」。
- 安全边界：`contextIsolation`/`sandbox`/`webSecurity` 全开，仅通过 `preload.js` 暴露最小窗口控制 IPC。

---

## 开发者

> 普通用户无需看下面内容。以下面向想改代码、重新打包、排查问题的人。

### 运行（开发模式）

```powershell
cd desktop
npm install    # 安装 Electron（首次下载 ~190MB 二进制）
npm start
```

### 工作原理

#### 启动 DSH 的运行器（三级回退）

1. 打包内嵌了 `@deepseek-ai/dsh` → 用 Electron 内嵌 Node（`ELECTRON_RUN_AS_NODE=1`）跑 `bin.js`；
2. 本机 npx 缓存里有 `@deepseek-ai/dsh` → 用**系统 `node.exe` 直接跑 `bin.js`**（`shell:false`，避开 Electron 下 npx/cmd/shell 的 stdio 捕获问题——这是之前「启动超时」的根因）；
3. 兜底回退 `npx`。

#### 端口 3080 共享（关键）

端口固定为 **3080**，与官方 `dsh web` 一致。桌面端启动时会先探测 3080 上是否已有 DSH 实例：

- **有** → 直接复用（`ownsServer = false`），不重复起服务；退出时**不杀**这个共享实例，避免误伤网页端正在用的会话。
- **没有** → 自己起一个（`ownsServer = true`），退出时回收。

好处：网页端和桌面端是同一个 DSH 进程，**会话实时同步**；也不会两个进程并发写同一份会话日志导致 `corrupt Zstandard session log`。

#### 窗口标题栏

桌面端使用 Electron/Windows 系统原生标题栏（`frame: true`），窗口标题为 `DeepSeek Harness`，并关闭 Electron 默认应用菜单（File、Edit、View、Window、Help）。桌面端不向 Web 页面注入标题栏 DOM 或 CSS，也不修改 `body`、`#root`、滚动模型或 sidebar CSS 变量。

- 窗口控制、拖动区域、最大化和系统菜单由 Windows 原生窗口处理；
- 使用 `assets/icon.ico` 作为窗口和任务栏图标，页面内 DSH logo 保持原样；
- DIY 主题只作用于 Web 页面，网页和插件的布局、按钮命中区域、透明度由 Web 自己管理；
- `dsh-better-sidebar` 展开时继续由其 `--dsh-sidebar-width` 和 `#root` 布局逻辑推动主对话区域，不受桌面壳干预；
- 这是为了保证 Web 插件行为与浏览器中一致；当前 Windows 版本不再绘制左侧 macOS 红绿灯。

#### 托盘

托盘图标是品牌蓝→强调紫渐变的**多尺寸 ICO**（`assets/icon.ico`，16/24/32/48/256）。关窗默认最小化到托盘（不退出），托盘菜单「退出」才真正结束。

#### 启动画面

启动阶段（profile 初始化 + DSH 服务就绪约 2 秒）会先弹出一个小的启动窗口：深色背景 + 转圈动画 + 「正在启动，请稍候…」。DSH 就绪后自动关闭并切入主窗口；启动失败则先关掉再弹错误框。实现：`main.js` 的 `createSplash()/closeSplash()` + `splash.html`。

### 打包分发

```powershell
npm run pack           # 仅生成未打包目录 dist\win-unpacked（便携版，直接跑 DSH.exe）
npm run dist           # 生成 Windows NSIS 安装包 dist\DSH Setup 0.1.5.exe
```

已内置的打包坑位规避（`package.json` build 字段）：

- `electronDist: node_modules/electron/dist`：复用本地 Electron 二进制，避免从 GitHub 下载 115MB zip（此网络下易损坏）。
- `win.signAndEditExecutable: false`：跳过 winCodeSign 的 rcedit/签名——非管理员、未开「开发者模式」时 winCodeSign 解包里的 macOS 符号链接会报「无法创建符号链接」。exe 图标改由 `afterPack`（`scripts/after-pack.cjs`）用 rcedit 单独写入，不依赖 winCodeSign。

#### 自包含打包（关键）

安装包把整套 DSH 运行时都打了进去，目标机器**不需要装 Node / pnpm / git，首启也不需要联网**：

- `@deepseek-ai/dsh`（完整 harness，含 dsh-base + dsh-web-app 等 bundle）随包内置；
- `dsh-ui-customizer` 主题插件随包内置（`file:` 依赖直接进 node_modules），loader 从 profile 兜底目录解析到它，**不往 profile 里装任何东西**——这就是首启离线的根本原因。

**为什么用 npm 而不是 pnpm**：electron-builder 的 node_modules 收集器对 pnpm 不可靠——25.x 会把 hoisted 布局铺成嵌套/残缺树（缺 `commander`、`cordis-plugin-group` 等），26.x 又会在 `pnpm list --depth Infinity` 上对这么大的 harness 直接 OOM。npm 天生扁平，electron-builder 对 npm 的处理是久经考验的主路径，所以打包侧改用 npm（`package-lock.json`）。

**为什么把 19 个 `dsh-*`「服务定义」包加成直接依赖**：electron-builder 只沿 `dependencies`/`optionalDependencies` 收集，不沿 `peerDependencies`。DSH 的服务提供方把 `dsh-compaction`、`dsh-invariants`、`dsh-fs` 等作为 peer 引用，若不加成直接依赖，它们会被从生产树里丢掉，运行时 `ERR_MODULE_NOT_FOUND`。`node-addon-require-builtin-win32-x64-msvc` 也按同样思路加成直接依赖，保证原生内部加载器（HMR 与外置插件解析都要靠它）一定被带上。

> 注意：`node-addon-require-builtin-*` 目前只加了 Windows 的 `win32-x64-msvc` 变体。以后要出 macOS / Linux 安装包，需照同样方式把对应平台变体（`-darwin-arm64`、`-darwin-x64`、`-linux-x64-gnu` 等）加为直接依赖。

#### 发 Release

1. `npm run dist` 生成 `dist\DSH Setup 0.1.5.exe`（产物文件名带空格）。
2. 把 exe 和 blockmap 重命名为连字符版（`DSH-Setup-0.1.5.exe`、`DSH-Setup-0.1.5.exe.blockmap`），与 `latest.yml` 里的 `url` 对齐——否则 electron-updater 自动更新会 404。
3. 在 GitHub 上基于 `v0.1.5` 标签新建 Release，上传三个文件：`DSH-Setup-0.1.5.exe`、`DSH-Setup-0.1.5.exe.blockmap`、`latest.yml`。`latest` 永远指向最新版。
