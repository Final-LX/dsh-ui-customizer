# DSH 桌面客户端

这是一个 Windows Electron 桌面外壳：它启动或复用本机 DSH Web 服务，再使用原生窗口打开网页界面。Web 页面和插件仍然按浏览器中的原生逻辑运行，桌面端不重写页面布局。

## 面向普通用户

### 安装包包含什么

| 文件 | 用途 |
|---|---|
| `DSH-Setup-<版本>.exe` | Windows 安装程序，普通用户只需下载这个文件 |
| `DSH-Setup-<版本>.exe.blockmap` | Electron 自动更新使用，普通安装不需要单独打开 |
| `latest.yml` | Electron 自动更新元数据 |

普通用户只需要下载 `.exe` 安装程序。`.blockmap` 和 `latest.yml` 由发布者上传到同一个 Release，供自动更新使用。

### 安装步骤

1. 从项目的 [最新 Release](https://github.com/Final-LX/dsh-ui-customizer/releases/latest) 下载 `DSH-Setup-<版本>.exe`。
2. 双击安装程序，按向导选择安装目录。
3. 如果 Windows SmartScreen 提示程序未签名，点击“更多信息”→“仍要运行”。
4. 安装完成后，从桌面或开始菜单启动 DSH。

当前安装包未进行代码签名，因此首次运行可能出现 SmartScreen 提示。这是分发状态提示，不代表安装包需要 Node.js 或 git。

### 第一次启动

桌面端会显示启动画面，并按以下顺序工作：

1. 检查 `~\.dsh\profiles\web`；
2. 如果 `3080` 已有可用 DSH Web 服务，则直接复用；
3. 如果没有，则使用安装包内置的 DSH 运行时启动服务；
4. 服务就绪后，在窗口中打开 DSH Web 页面。

如果是首次使用 DSH，仍需要在 DSH 自带设置中配置模型和 API key。桌面客户端不会替你填写或托管 API key。

### 使用 DIY 主题

打开 DSH 后：

```text
设置 → DIY 主题
```

修改主题后：

- “试穿”：只预览当前草稿；
- “应用”：保存当前配置；
- “还原”：撤销尚未应用的修改；
- “重置为默认”：把草稿恢复为默认值；
- “我的方案”：保存、应用或删除命名方案。

可调整内容包括配色、字体、缩放、背景图片/视频、面板通透度、毛玻璃强度、阴影和圆角。

## 桌面端行为

### 窗口

桌面端使用 Windows 原生标题栏：

- 窗口标题固定为 `DeepSeek Harness`；
- 使用安装包内的 `assets/icon.ico` 作为窗口和任务栏图标；
- 不显示 Electron 默认的 File、Edit、View、Window、Help 应用菜单；
- 不向 Web 页面注入标题栏 DOM 或 CSS；
- 不修改 Web 页面的 `body`、`#root`、滚动模型或 sidebar CSS 变量。

因此 DSH 原生按钮、`dsh-better-sidebar`、session log 下载按钮和其他 Web 插件不会被桌面层覆盖。侧边栏展开后的主内容区域由 Web 插件自己的布局逻辑负责调整。

### 托盘

关闭窗口默认会隐藏到系统托盘，DSH 服务继续运行。托盘右键菜单提供：

- 显示窗口；
- 刷新窗口；
- 打开日志；
- 退出。

如果需要真正结束桌面客户端，请在托盘菜单中点击“退出”。

### 和网页版的关系

桌面端和网页版默认使用：

```text
地址：http://127.0.0.1:3080
profile：web
```

桌面端启动时会探测已有的 DSH Web 服务并复用它。不要在桌面端已经启动并占用 `3080` 时，再启动第二个独立的 `npx @deepseek-ai/dsh web`；如果确实需要运行命令行版本，请先退出桌面客户端，或显式使用其他端口和 profile。

会话由 DSH 服务端管理，因此复用同一实例时可以同步；主题配置和本地媒体属于浏览器端数据，桌面端和普通浏览器不会自动共享这些内容。

## 数据和密钥

| 数据 | 默认位置 | 说明 |
|---|---|---|
| DSH profile、会话、服务日志 | `%USERPROFILE%\.dsh\` | 包含 `profiles\web` 和 `desktop.log` |
| 桌面端 localStorage/IndexedDB | Electron userData 目录 | 保存主题配置、方案、图片和视频引用 |
| 主题插件代码 | 安装目录 | 桌面端随包内置 |

桌面壳不读取或代管 API key。你可以使用 DSH 设置页面配置，或使用 DSH 支持的环境变量，例如：

```powershell
$env:DEEPSEEK_API_KEY = "你的 key"
$env:DEEPSEEK_BASE_URL = "可选的网关地址"
```

不要把真实密钥提交到仓库、截图或日志中。

## 常见问题

### 启动后白屏怎么办？

先确认是否有旧的桌面进程或其他 DSH 进程占用 `3080`。再从托盘退出桌面端，重新启动。若仍失败，打开托盘菜单中的“打开日志”，把错误信息保存下来。

### 看到端口占用错误怎么办？

典型错误是：

```text
EADDRINUSE: address already in use 127.0.0.1:3080
```

这表示另一个程序已经使用 `3080`。桌面端能识别并复用正常的 DSH Web 实例，但不会复用任意占用该端口的程序。请关闭冲突服务后重试。

### 为什么主题在浏览器和桌面端不一样？

Electron 和普通浏览器使用不同的浏览器 profile。主题配置、方案、图片和视频保存在各自的浏览器本地存储中；这是正常的。会话是否同步取决于两端是否连接到同一个 DSH 服务实例。

### 如何找到日志？

默认位置：

```text
%USERPROFILE%\.dsh\desktop.log
```

也可以通过托盘菜单“打开日志”查看。日志达到一定大小后会自动轮转，避免无限增长。

## 环境变量

| 变量 | 默认值 | 作用 |
|---|---|---|
| `DSH_PROFILE` | `web` | DSH profile 名称 |
| `DSH_PORT` | `3080` | DSH Web 端口 |
| `DSH_HOME` | `~\.dsh` | DSH 数据根目录 |

如果修改 `DSH_PORT` 或 `DSH_PROFILE`，桌面端可能不再连接默认网页版使用的数据和服务。除非你清楚 profile 和端口的关系，否则建议保持默认值。

## 开发者说明

### 开发环境

```powershell
cd desktop
npm install
npm start
```

开发模式会安装 Electron 和桌面端依赖。生产安装包则把 DSH 运行时和主题插件一起打入，不依赖目标机器的 Node.js、pnpm、git。

### 验证和打包

在仓库根目录运行插件测试：

```powershell
npm test --prefix .\dsh-ui-customizer
```

在 `desktop` 目录运行：

```powershell
npm run pack    # dist\win-unpacked，便携测试目录
npm run dist    # Windows NSIS 安装包
```

打包前应关闭正在运行的 `dist\win-unpacked\DSH.exe`，否则 Windows 可能锁定 `icudtl.dat` 等文件并导致 `EBUSY`。

### 运行器和离线行为

打包版优先使用随包内置的 `@deepseek-ai/dsh` 和 Electron 内嵌 Node。安装包模式下如果内置运行时缺失，桌面端会报错，不会偷偷通过 npx 联网补装。开发模式才保留外部运行器回退，便于本地调试。

### 发布文件

`npm run dist` 会生成带空格的 electron-builder 文件名。上传 Release 前，按照项目发布约定把它们重命名为：

```text
DSH-Setup-<版本>.exe
DSH-Setup-<版本>.exe.blockmap
latest.yml
```

`latest.yml` 中的 `url`、文件大小和 SHA-512 必须与上传的 EXE 完全一致。三个文件应上传到同一个 GitHub Release。

### 平台范围

当前自包含运行时和原生目录选择器补丁主要针对 Windows x64。package.json 中的其他平台目标不代表已经完成同等程度的发布和测试；如果要发布 macOS 或 Linux，需要补充对应原生依赖、图标、构建机和平台测试。
