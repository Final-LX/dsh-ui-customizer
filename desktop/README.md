# DSH 桌面客户端

用 Electron 把 DSH 的浏览器界面包成独立桌面窗口：本地起 `dsh web`，等它就绪后开原生窗口；带首次引导、日志落盘、崩溃恢复和托盘。

## 运行（开发模式）

```powershell
cd desktop
pnpm install          # 安装 Electron + @deepseek-ai/dsh（内嵌 Node 运行器用）
pnpm start
```

首次启动会做「首次引导」：确保 `web` profile 存在、安装 `dsh-ui-customizer` 插件、登记 loader；之后起服务开窗口。

## 打包分发

```powershell
pnpm pack              # 仅生成未打包目录（快速验证）
pnpm dist              # 生成 Windows NSIS / macOS dmg / Linux AppImage
```

- 打包后用 **Electron 内嵌 Node**（`ELECTRON_RUN_AS_NODE=1`）跑 `@deepseek-ai/dsh/lib/bin.js`，不再依赖系统 node/npx。
- `asarUnpack` 把 `@deepseek-ai/**` 解出 asar，避免 DSH 的 ESM 动态 import 在 asar 内失败。
- 自动更新走 `electron-updater` + GitHub Releases（`build.publish` 已指向 `Final-LX/dsh-ui-customizer`）。发版时用 `GH_TOKEN` 触发 electron-builder 上传 artifacts。

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

- **首次引导需要 pnpm**：`dsh plugin add` 转发给 pnpm 安装插件。开发模式没问题；打包版若要全新安装插件，机器上需有 pnpm（或事先已初始化好 `~/.dsh/profiles/web`）。
- 托盘图标是占位图标（`assets/icon.png`，由 `scripts/gen-icon.cjs` 生成），可自行替换成正式图标。
- 关窗默认**最小化到托盘**（不退出），在托盘菜单里「退出」才会真正结束进程；退出时用 `taskkill /T` 回收整个 DSH 进程树。
- 安全边界保持 `contextIsolation`/`sandbox`/`webSecurity` 全开，未向渲染进程暴露任何 Node/IPC 能力。
