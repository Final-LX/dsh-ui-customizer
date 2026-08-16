# DSH 桌面客户端

用 Electron 把 DSH 的浏览器界面包成独立桌面窗口：本地起 `dsh web`，等它就绪后开原生窗口，关窗即回收服务。

## 运行

```powershell
cd desktop
pnpm install          # 或 npm install（安装 Electron）
pnpm start            # 或 npm start
```

首次启动会用 `npx --yes @deepseek-ai/dsh web --profile web` 拉起本地服务：
- 默认复用 `~/.dsh/profiles/web` 这个 profile（也就是你已装 `dsh-ui-customizer` 的那个）。
- `--port 0` 让 OS 分配空闲端口，避免和已在跑的 3080 冲突；窗口地址从 `dsh web: http://127.0.0.1:PORT` 日志解析，不需要手填。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `DSH_PROFILE` | `web` | 用哪个 DSH profile（需已装主题插件） |
| `DSH_PORT` | `0` | 指定端口；`0` 表示自动分配 |

## 说明与限制

- 桌面壳不改变 DSH 本身：主题定制仍走 `dsh-ui-customizer` 插件（设置 → DIY 主题），与本仓库主目录同源。
- 关窗 / 退出时用 `taskkill /T`（Windows）或 `SIGTERM`（macOS/Linux）回收整个 DSH 进程树，避免残留。
- 首次启动若本地没有 `@deepseek-ai/dsh`，`npx --yes` 会自动下载。
- 目前是「壳 + 复用现有 profile」的最小可用形态；后续可加：内置 profile 自举（首次运行自动 `dsh plugin add`）、自动更新（electron-updater）、托盘最小化到后台。
