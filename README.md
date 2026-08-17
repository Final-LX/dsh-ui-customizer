# dsh-ui-customizer

面向 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 的主题定制插件 + Electron 桌面客户端。

- **插件（dsh-ui-customizer）**：不改任何源码，装进 web profile 后，在「设置 → DIY 主题」里实时调整配色、字体、背景、圆角、阴影等，配置持久化在浏览器。
- **桌面端（desktop/）**：把 `dsh web` 包成独立原生窗口——macOS 风格红绿灯标题栏、跟随主题、托盘常驻，并且与网页端**共享同一个 DSH 实例**，会话实时同步。

---

## 快速开始

### 方式 A：只用插件（网页端）

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

### 方式 B：桌面端（打包好的 exe）

下载安装包双击安装即可，无需手敲命令：

- 最新版：<https://github.com/Final-LX/dsh-ui-customizer/releases/latest>
- 全部版本：<https://github.com/Final-LX/dsh-ui-customizer/releases>

详见 [`desktop/README.md`](desktop/README.md)。

---

## 插件

### 特性

- **配色**：8 套皮肤（一键整套配色）+ 品牌/强调/成功/警告/错误 5 个取色器 + 中性色调（蓝灰/冷灰/暖灰/石墨），派生文字、边框、代码块、引用色
- **字体**：界面字体 + 代码字体（下拉选择）+ 整体缩放 80–140% + 字号缩放 80–130%
- **背景**：内置壁纸 / 上传图片（前端压缩到 1920px JPEG）/ 图片 URL / **视频背景（mp4 上传或 URL）** / 面板通透度 / 毛玻璃
- **组件**：圆角 0–24px + 阴影层级（无/轻/标准/强）
- **皮肤中心**：点选即试穿、满意再应用、未保存可还原
- **我的方案**：整套配置保存成命名方案，一键快捷切换
- **可读性**：覆盖层（对话框/菜单/输入/提示）固定高不透明，通透度只作用于环境背景

### 截图

![整体效果](docs/screenshot-overview.png)

![DIY 主题设置面板](docs/screenshot-panel.png)

### 使用

打开 Web GUI → 右上角 **设置** → 左侧导航 **DIY 主题**，按分组调整。

顶部「启用 DIY 主题」是总开关：关闭后本插件完全不生效（方便让 dsh-web-ui 的皮肤中心接管），打开后恢复。

所有改动都是「试穿」：实时预览但不落盘；点右上角「应用」保存，「还原」撤销未保存的更改。

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

### 与其他插件共存（dsh-web-ui）

本插件可以和 [dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui) 全家桶并存：**功能用 dsh-web-ui，主题定制用本插件**。

```powershell
dsh plugin --profile web add @linxin666/dsh-web-ui-all   # 功能全家桶
dsh plugin --profile web add "git+https://github.com/Final-LX/dsh-ui-customizer"   # 本插件
```

两者都会改主题 token，用「启用 DIY 主题」开关切换：开 = 本插件接管，关 = 用 dsh-web-ui 皮肤中心。

---

## 桌面端

`desktop/` 里的 Electron 客户端，把 DSH 界面包成独立窗口。完整说明见 [`desktop/README.md`](desktop/README.md)，要点：

- **macOS 风格标题栏**：左上角红绿灯（关闭/最小化/最大化），背景/边框跟随 DIY 主题，无多余文字。
- **与网页端共享实例**：端口统一为 **3080**（和官方 `dsh web` 一致）。桌面端启动时会探测到已有的 DSH 实例并直接复用——会话实时同步，也不会两个进程并发写会话日志。
- **托盘常驻**：渐变图标，关窗最小化到托盘；退出时只回收自己启动的 DSH，不误杀复用的网页端实例。
- **自包含**：harness + pnpm + 主题插件随包内置，首启离线，目标机器无需 Node/pnpm/git。
- **日志/崩溃恢复**：日志落盘到 `~/.dsh/desktop.log`；DSH 意外退出会弹窗让用户选择重启/退出。
- **API key 与官方一致**：不自动填、不代管密钥，走 DSH 自带引导或 `DEEPSEEK_API_KEY` 环境变量。

---

## 数据与存储

| 数据 | 位置 | 说明 |
|---|---|---|
| DIY 配置 / 方案 | 浏览器 localStorage | `dsh-ui-customizer:config:v3`、`dsh-ui-customizer:schemes` |
| 上传的图片/视频 | 浏览器 IndexedDB | 库 `dsh-ui-customizer`、store `media`，配置里只存 `idb:` 引用 |
| DSH profile/会话/日志 | `~/.dsh/` | 服务端数据 |

上传的图片/视频存在 IndexedDB 而非 localStorage，不受 5MB 配额限制，刷新后自动恢复。

---

## 测试

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

## CI（同步官方更新）

`.github/workflows/ci.yml` 用 GitHub Actions 跑「官方 latest + 固定版」双矩阵，执行上面的测试 + token 比对；每天 UTC 03:00 定时跑。官方还是 RC 阶段、契约（token 名、`dsh.client`、DOM 类名）易变，红灯了就说明要核对升级。

## 换壁纸

```powershell
npm run wallpaper -- "C:\path\to\image.png"
```

图片压成 1920px JPEG，写入 `assets/wallpaper.txt` 并内嵌进 `lib/client.js`，然后重新 `add` + 重启。

## 关键契约（跨 DSH 版本升级时核对）

- `exports` 必须暴露 `"./package.json"`：`client-modules` 靠 `require.resolve('<pkg>/package.json')` 读 `dsh.client`，缺失会被判为「非客户端包」。
- 客户端 bundle 是 classic `<script>`，必须以 `window.__ModuleLoader__.load({...})` 注册 factory。
- `package.json` 的 `dsh.client` 需含 `{ platform: "web", immediately: true, inject: [...] }`。

## 目录结构

```
dsh-ui-customizer/
├── package.json          # exports["./client"] + dsh.client + peerDeps + scripts
├── install.ps1           # 一键安装（开发用）
├── docs/                 # 截图
├── assets/wallpaper.txt  # 壁纸 data URI
├── .github/workflows/ci.yml  # CI 矩阵 + token 比对
├── desktop/              # Electron 桌面客户端（含安装包）
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
