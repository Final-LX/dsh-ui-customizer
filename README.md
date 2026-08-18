# DSH UI Customizer

为 [DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness) 提供可视化主题定制插件，并附带一个 Windows 桌面客户端。

## 先看这里：你应该选择哪种方式？

| 你的情况 | 推荐方式 |
|---|---|
| 不想安装 Node.js，不想使用命令行 | 下载 Windows 桌面客户端 |
| 已经在使用 `dsh web`，只想安装主题插件 | 使用网页端安装脚本 |
| 想修改源码或重新打包 | 按本文末尾的开发者说明操作 |

> 桌面客户端和网页版使用同一个 DSH 服务端口（默认 `3080`）。日常使用时只需要选择一个入口，不要同时启动两个独立的 `dsh web` 服务。

## Windows 桌面客户端

桌面客户端是一个 Electron 外壳，负责启动或复用本地 DSH 服务，然后在原生窗口中打开 DSH Web 页面。它不会重写 DSH 页面的布局，也不会接管插件的按钮、侧边栏或会话区域。

### 安装

1. 打开 [最新 Release](https://github.com/Final-LX/dsh-ui-customizer/releases/latest)。
2. 下载 `DSH-Setup-<版本>.exe`。
3. 双击安装包，按向导完成安装。
4. 如果 Windows SmartScreen 提示程序未签名，选择“更多信息”后点击“仍要运行”。
5. 安装完成后，从桌面或开始菜单启动 DSH。

桌面客户端是 Windows 自包含版本：目标机器不需要预先安装 Node.js、pnpm、git，正常启动不依赖网络。当前发布包未进行代码签名，因此可能出现 SmartScreen 提示。

### 第一次使用

1. 启动 DSH。
2. 按 DSH 自带引导配置模型和 API key。
3. 打开右上角“设置”。
4. 在设置侧栏选择“DIY 主题”。
5. 修改设置后先点击“试穿”预览；确认后点击“应用”。
6. 点击“还原”可以撤销尚未应用的修改。

桌面客户端使用 Windows 原生窗口标题栏，窗口标题为 **DeepSeek Harness**。Web 页面中的 DSH logo、侧边栏、会话日志下载和第三方插件均由 Web 页面自己管理。

## DIY 主题可以调整什么

| 分组 | 功能 | 说明 |
|---|---|---|
| 总开关 | 启用 DIY 主题 | 关闭后撤销本插件的主题覆盖 |
| 皮肤中心 | 预设皮肤 | 选择预设后可以继续手动调整 |
| 配色 | 品牌、强调、成功、警告、错误色 | 支持颜色选择器和十六进制颜色 |
| 配色 | 中性色调 | 蓝灰、冷灰、暖灰、石墨等方向 |
| 字体 | 界面字体、代码字体 | 使用预设字体栈 |
| 字体 | 整体缩放、字号缩放 | 分别控制界面比例和文字比例 |
| 背景 | 内置壁纸、本地图片、视频、URL | 本地图片和视频保存在浏览器本地 |
| 背景 | 面板通透度、毛玻璃强度 | 数值过高可能增加渲染负担 |
| 组件 | 阴影、圆角 | 调整组件层次感和圆角大小 |
| 我的方案 | 保存和切换方案 | 将整套主题配置保存为命名方案 |

主题修改保存在当前浏览器环境中。桌面客户端和普通浏览器属于不同的浏览器环境，因此主题配置、方案、上传的图片和视频不会自动互通；DSH 服务端的会话数据仍然可以共享。

## 网页端安装

### 方案 A：使用安装脚本（只需要 Node.js）

适合已经安装 Node.js、但没有 git 或 pnpm 的用户。

1. 从 GitHub 下载本仓库 ZIP 并解压。
2. 在 PowerShell 中进入解压后的仓库目录。
3. 执行：

```powershell
.\install-web.ps1
```

4. 启动网页版：

```powershell
npx @deepseek-ai/dsh web
```

5. 打开 DSH 的“设置 → DIY 主题”。

脚本会把插件复制到 `~\.dsh\profiles\web\node_modules\dsh-ui-customizer`，并在 `cordis.patch.yml` 中登记插件 loader。脚本可以重复运行。

### 方案 B：使用 DSH 插件命令

适合已经安装 Node.js、pnpm 和 git 的用户：

```powershell
dsh plugin --profile web add "git+https://github.com/Final-LX/dsh-ui-customizer"
```

如果命令行提示找不到 `dsh`，可以改用：

```powershell
npx @deepseek-ai/dsh plugin --profile web add "git+https://github.com/Final-LX/dsh-ui-customizer"
```

如果你的 profile 没有自动登记 loader，请打开：

```text
%USERPROFILE%\.dsh\profiles\web\cordis.patch.yml
```

确认其中包含：

```yaml
- insert:
    - id: ui-customizer
      name: dsh-ui-customizer
```

然后完全退出并重新启动 DSH Web。不要在已经占用 `3080` 的桌面客户端旁边再次启动第二个 `dsh web`；二者默认使用同一个端口。

## 数据、安全与兼容性

- 主题配置和方案保存在浏览器的 `localStorage`。
- 本地图片和视频保存在浏览器的 IndexedDB。
- 本插件不会把主题配置或本地媒体上传到 DSH 服务端。
- 网络图片或视频 URL 是否能加载，取决于地址、协议、浏览器安全策略和服务器响应。
- 大尺寸图片、高清视频和高强度毛玻璃可能增加内存或 GPU/CPU 负担。
- DSH 仍处于快速迭代阶段，官方 token、slot 和页面结构变化可能影响插件兼容性。

## 常见问题

### 桌面端和网页版能不能同时打开？

可以复用同一个已经运行的 DSH 实例，但不建议同时启动两个 `dsh web` 进程。默认端口是 `3080`，第二个进程通常会收到 `EADDRINUSE` 端口占用错误。

### 关闭桌面窗口后，为什么 DSH 还在运行？

桌面客户端默认关闭窗口时隐藏到系统托盘，不会立即退出 DSH。请在托盘菜单中选择“退出”才能结束桌面客户端及其管理的服务。

### 主题配置为什么没有在浏览器和桌面端同步？

因为 Electron 和普通浏览器使用不同的浏览器 profile。会话由 DSH 服务端管理，所以可以共享；主题配置和 IndexedDB 媒体属于浏览器端数据，所以默认独立保存。

### 如何查看启动日志？

桌面客户端托盘菜单中选择“打开日志”。默认日志文件为：

```text
%USERPROFILE%\.dsh\desktop.log
```

## 开发者说明

### 目录结构

```text
dsh-ui-customizer/
├── lib/client.js                 # 浏览器端 classic bundle
├── lib/index.js                  # 宿主侧入口
├── package.json                  # 插件元数据和 dsh.client 配置
├── desktop/                      # Electron Windows 桌面客户端
│   ├── main.js                   # 主进程：服务、窗口、托盘、更新
│   ├── preload.js                # 最小窗口 IPC
│   ├── splash.html               # 启动画面
│   ├── vendor/                   # 桌面端内置插件副本
│   └── README.md                 # 桌面端开发说明
├── tools/                        # 测试和资源工具
├── docs/                         # 截图和介绍文章
├── install.ps1                   # 使用 DSH/pnpm 的网页端安装脚本
└── install-web.ps1               # 只依赖 Node.js 的网页端安装脚本
```

### 安装依赖和测试

```powershell
npm test
```

等价于：

```powershell
node tools/test-client.cjs
node tools/test-render.cjs
node tools/test-idb.cjs
```

### 桌面端开发和打包

```powershell
cd desktop
npm install
npm start       # 开发模式
npm run pack    # 生成 dist\win-unpacked
npm run dist    # 生成 Windows NSIS 安装包
```

打包使用 npm 的扁平 `node_modules`，因为当前 DSH 运行时包含大量 peer/service definition 依赖，electron-builder 对 npm 布局的收集更稳定。发布文件通常为：

```text
DSH-Setup-<版本>.exe
DSH-Setup-<版本>.exe.blockmap
latest.yml
```

### 主题插件关键契约

- `package.json` 必须导出 `./package.json`，以便 DSH 读取 `dsh.client`。
- 客户端 bundle 必须以 `window.__ModuleLoader__.load({...})` 注册。
- `dsh.client` 需要声明 `platform: "web"`、`immediately: true` 和所需的 `inject` 服务。
- 升级 DSH 版本后，应运行测试并检查官方 token/CSS 契约。

## 许可证

MIT
