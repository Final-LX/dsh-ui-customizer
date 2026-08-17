# DSH 桌面客户端 + DIY 主题

给 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 加一套「DIY 主题」定制面板，并提供一个开箱即用的桌面客户端。

> **不需要会命令行**：下载 exe → 双击安装 → 打开就能用。

## 这是什么

- **DIY 主题（dsh-ui-customizer）**：在「设置 → DIY 主题」里改配色、字体、背景、圆角、阴影，改完立即生效，配置保存在浏览器里。
- **桌面客户端（desktop/）**：把 DSH 网页界面包成一个独立窗口——macOS 风格红绿灯标题栏、托盘常驻，并且和网页版**共享同一个 DSH 实例**，会话实时同步。

## 下载安装（推荐：桌面客户端）

1. 打开 [Releases](https://github.com/Final-LX/dsh-ui-customizer/releases/latest) 页面，下载 `DSH-Setup-<版本>.exe`；
2. 双击运行，在安装向导里点「安装」（可改安装目录）；
3. 若弹 Windows SmartScreen 提示，点「更多信息」→「仍要运行」（因为安装包未签名）；
4. 装完勾选「运行 DSH」直接启动，或从桌面/开始菜单的「DSH」快捷方式启动。

**完全离线自包含**：不需要装 Node、pnpm、git，首启也不需要联网。

- 最新版：<https://github.com/Final-LX/dsh-ui-customizer/releases/latest>
- 全部版本：<https://github.com/Final-LX/dsh-ui-customizer/releases>

## 使用

1. 打开桌面客户端（或网页版 `dsh web`）；
2. 右上角「设置」→ 左侧「DIY 主题」；
3. 按分组调整，改完立即预览；
4. 点「应用」保存，「还原」撤销未保存的更改。

### 能调什么

| 分组 | 控件 | 说明 |
|---|---|---|
| （总开关） | 启用 DIY 主题 | 关闭后撤销全部覆盖 |
| 皮肤中心 | 8 张色板卡片 | 点选即试穿整套配色/通透度/毛玻璃/圆角 |
| 配色 | 品牌/强调/成功/警告/错误 | 5 个取色器，带 hex 值 |
| | 中性色调 | 蓝灰/冷灰/暖灰/石墨 |
| 字体 | 界面字体 / 代码字体 | 下拉选择预设字体栈 |
| | 整体缩放 | 80–140% |
| | 字号缩放 | 80–130% |
| 背景 | 使用内置壁纸 | 开关内嵌壁纸 |
| | 上传背景图 | 本地图片，压缩后存 IndexedDB |
| | 上传视频 | mp4，存 IndexedDB，刷新后恢复 |
| | 背景 URL | 网络图或 data URI |
| | 面板通透度 | 0–100% |
| | 毛玻璃强度 | 0–30px，0 关闭（最省性能） |
| 组件 | 阴影层级 | 无/轻/标准/强 |
| | 圆角 | 0–24px |
| 我的方案 | 命名方案 | 整套配置存成方案，一键切换 |

### 截图

![整体效果](docs/screenshot-overview.png)

![DIY 主题设置面板](docs/screenshot-panel.png)

## 常见问题

- **SmartScreen 提示「Windows 已保护你的电脑」？** 点「更多信息」→「仍要运行」。这是未签名程序的正常提示，不影响使用。
- **桌面版和网页版数据同步吗？** 会话（聊天记录）同步——两者共用同一个 DSH 实例和 3080 端口；但主题配置存在各自浏览器的 localStorage 里，不互通。
- **主题配置和上传的图片存哪？** 都存在浏览器本地（localStorage + IndexedDB），不上传到 DSH 服务器端。

---

## 只用插件（网页端，进阶）

如果你已经会用命令行，且只想在网页版用主题插件、不装桌面客户端：

```powershell
dsh plugin --profile web add "git+https://github.com/Final-LX/dsh-ui-customizer"
```

然后在 `~\.dsh\profiles\web\cordis.patch.yml` 里登记 loader 行并重启：

```yaml
- insert:
    - id: ui-customizer
      name: dsh-ui-customizer
```

```powershell
npx @deepseek-ai/dsh web
```

打开右上角「设置 → DIY 主题」即可开始定制。

---

## 开发者

> 普通用户无需看这里。下面内容面向想改代码、跑测试、重新打包的人。

### 桌面端开发与打包

```powershell
cd desktop
npm install    # 安装 Electron（首次下载 ~190MB 二进制）
npm start      # 开发模式运行
npm run dist   # 生成 Windows 安装包
```

完整说明见 [`desktop/README.md`](desktop/README.md)。

### 测试

```powershell
npm test
# 等价于：
node tools/test-client.cjs   # 无头测试：factory+apply+渲染+防抖+上传
node tools/test-render.cjs   # 真实 React 渲染测试
node tools/test-idb.cjs      # IndexedDB 媒体存储：上传→引用→刷新恢复
```

Token 兼容性检查（CI 里跑，需先装官方 DSH 拉取 `dsh-web-frontend` 的 dist CSS）：

```powershell
pnpm add -D --ignore-scripts "@deepseek-ai/dsh@latest"
node tools/test-tokens.cjs
```

### CI（同步官方更新）

`.github/workflows/ci.yml` 用 GitHub Actions 跑「官方 latest + 固定版」双矩阵，执行上面的测试 + token 比对；每天 UTC 03:00 定时跑。官方还是 RC 阶段、契约（token 名、`dsh.client`、DOM 类名）易变，红灯了就说明要核对升级。

### 换壁纸

```powershell
npm run wallpaper -- "C:\path\to\image.png"
```

图片压成 1920px JPEG，写入 `assets/wallpaper.txt` 并内嵌进 `lib/client.js`，然后重新 `add` + 重启。

### 关键契约（跨 DSH 版本升级时核对）

- `exports` 必须暴露 `"./package.json"`：`client-modules` 靠 `require.resolve('<pkg>/package.json')` 读 `dsh.client`，缺失会被判为「非客户端包」。
- 客户端 bundle 是 classic `<script>`，必须以 `window.__ModuleLoader__.load({...})` 注册 factory。
- `package.json` 的 `dsh.client` 需含 `{ platform: "web", immediately: true, inject: [...] }`。

### 目录结构

```
dsh-ui-customizer/
├── package.json          # exports["./client"] + dsh.client + peerDeps + scripts
├── install.ps1           # 一键安装（开发用）
├── docs/                 # 截图
├── assets/wallpaper.txt  # 壁纸 data URI
├── .github/workflows/ci.yml  # CI 矩阵 + token 比对
├── desktop/              # Electron 桌面客户端（自包含）
│   ├── main.js           # 主进程：启动/复用 DSH、窗口、托盘、自包含引导
│   ├── preload.js        # 最小窗口控制 IPC
│   ├── splash.html       # 启动等待画面（正在启动）
│   ├── vendor/           # 随包内置的主题插件副本（file: 依赖）
│   ├── scripts/          # after-pack（rcedit 图标）+ 图标渲染
│   ├── assets/           # 图标（icon.ico / icon.svg / icon-source.webp）
│   └── README.md         # 桌面端完整文档
├── tools/
│   ├── set-wallpaper.cjs    # 换壁纸
│   ├── inject-wallpaper.cjs # 仅重新内嵌壁纸
│   ├── test-client.cjs      # 无头测试
│   ├── test-render.cjs      # 真实 React 渲染测试
│   ├── test-idb.cjs         # IndexedDB 媒体存储测试
│   └── test-tokens.cjs      # token 兼容性检查
└── lib/
    ├── index.js          # 宿主侧 no-op 入口
    └── client.js         # 浏览器 bundle：设置面板 + 主题 + CSS
```
