# DSH 桌面客户端

用 Electron 把 DSH 的浏览器界面包成独立桌面窗口：本地起 `dsh web`，等它就绪后开原生窗口；带首次引导、日志落盘、崩溃恢复和托盘。

## 运行（开发模式）

```powershell
cd desktop
pnpm install          # 安装 Electron（首次会下载 ~190MB 二进制）
pnpm start
```

开发模式用系统 `npx @deepseek-ai/dsh` 拉起服务（复用你已有的 npx 缓存与 `~/.dsh/profiles/web`），不需要在 `desktop/` 里再装一遍 DSH。

首次启动会做「首次引导」：检查 `web` profile，缺插件才 `dsh plugin add`（幂等，已装则跳过）、登记 loader；之后起服务开窗口。

## 打包分发

```powershell
pnpm pack              # 仅生成未打包目录 dist\win-unpacked（便携版，直接跑 DSH.exe）
pnpm dist              # 生成 Windows NSIS 安装包 dist\DSH Setup 0.1.0.exe
```

产出物：
- `dist\DSH Setup 0.1.0.exe` —— 安装包（已实测可生成，未签名，SmartScreen 会提示）。
- `dist\win-unpacked\DSH.exe` —— 便携版（不装也能直接双击运行）。
- `dist\latest.yml` + `.blockmap` —— 供 `electron-updater` 自动更新。

已内置的打包坑位规避（`package.json` build 字段）：
- `electronDist: node_modules/electron/dist`：复用本地 Electron 二进制，避免从 GitHub 下载 115MB zip（此网络下 GitHub 下载易损坏）。
- `win.signAndEditExecutable: false`：跳过 winCodeSign 的 rcedit/签名步骤——非管理员、未开「开发者模式」的 Windows 上，winCodeSign 解包里的 macOS 符号链接会让 electron-builder 报「无法创建符号链接」。代价是 exe 不内嵌图标/版本号（用默认 Electron 图标）。

若要真正上架/自动更新：把 `@deepseek-ai/dsh` 加回 `dependencies`（内嵌 Node 运行器才能解析到 `lib/bin.js`，否则打包版回退到系统 npx），发 GitHub Release 时配 `GH_TOKEN`。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `DSH_PROFILE` | `web` | 用哪个 DSH profile（web 模板自带 web-app） |
| `DSH_PORT` | `3099` | **固定端口**；localStorage/IndexedDB 按 origin（含端口）隔离，改端口会让主题配置和上传的图片/视频“换 origin 消失” |
| `DSH_HOME` | `~/.dsh` | DSH 数据目录（profile、日志也在此） |
| `DSH_WEB_UI` | 未设 | 设为 `1` 时首次引导额外安装 `@linxin666/dsh-web-ui-all` 全家桶 |

## 数据都在哪（重要）

两处分开，备份/迁移要一起：

- **服务端** `~/.dsh/`：profile、插件、会话、日志 `desktop.log`。
- **浏览器端**（Electron `userData`，Windows 在 `%APPDATA%/dsh-ui-desktop/`）：localStorage（DIY 主题配置、方案）与 IndexedDB（上传的图片/视频）。它们按 `http://127.0.0.1:3099` 这个 origin 存储，所以端口必须固定。

## 已知限制

- **运行器回退**：开发模式用 `npx`；打包模式才用内嵌 Node（需在 `dependencies` 加回 `@deepseek-ai/dsh` 并 `asarUnpack`）。
- **首次引导需要 pnpm**：`dsh plugin add` 转发给 pnpm 安装插件。开发模式没问题；打包版若要全新安装插件，机器上需有 pnpm（或事先已初始化好 `~/.dsh/profiles/web`）。
- **pnpm 11 会拦 electron 的 postinstall**：仓库已带 `desktop/pnpm-workspace.yaml`（`allowBuilds: electron: true`），首次 `pnpm install` 后若报 `ERR_PNPM_IGNORED_BUILDS`，跑一次 `pnpm rebuild electron` 下载二进制。
- 托盘图标是占位图标（`assets/icon.png`，由 `scripts/gen-icon.cjs` 生成），可自行替换成正式图标。
- 关窗默认**最小化到托盘**（不退出），在托盘菜单里「退出」才会真正结束进程；退出时用 `taskkill /T` 回收整个 DSH 进程树。
- 安全边界保持 `contextIsolation`/`sandbox`/`webSecurity` 全开，未向渲染进程暴露任何 Node/IPC 能力。
