# dsh-ui-customizer

一个用于 [`dsh web`](https://github.com/deepseek-ai/deepseek-harness) 的全方面 DIY 主题插件。
不改任何源码，装进 web profile 后，在 **设置 → DIY 主题** 里实时调整配色、字体、背景、圆角，
配置持久化到浏览器 localStorage。

## 特性

- 🎨 **配色**：8 套主题模板 + 品牌/强调/成功/警告/错误 5 个取色器，从 5 色派生约 37 个语义 token
- 🔤 **字体**：界面字体 + 代码字体（下拉选择）+ 整体缩放 80–140%
- 🖼 **背景**：内置壁纸 / 上传图片（前端压缩到 1920px JPEG）/ 图片 URL / 面板通透度 / 毛玻璃
- 🧩 **组件**：圆角 0–24px
- 👓 **可读性**：覆盖层（对话框/菜单/输入/提示）固定高不透明，通透度只作用于环境背景，文字始终清晰

## 截图

![整体效果](docs/screenshot-overview.png)

![DIY 主题设置面板](docs/screenshot-panel.png)

## 安装

```powershell
dsh plugin --profile web add "git+https://github.com/Final-LX/dsh-ui-customizer"
```

然后在 `~\.dsh\profiles\web\cordis.patch.yml` 里登记 loader 行，并重启：

```yaml
- insert:
    - id: ui-customizer
      name: dsh-ui-customizer
```

```powershell
npx @deepseek-ai/dsh web
```

> 本地源码安装/开发：克隆本仓库后，在目录里运行 `.\install.ps1` 一键安装，或
> `dsh plugin --profile web add "file:C:/path/to/dsh-ui-customizer"` + 手动登记上面那行。
> `dsh` 不在 PATH 时用 `npx @deepseek-ai/dsh plugin --profile web add ...` 代替。
> pnpm 对 `file:` 依赖默认是**拷贝**（非符号链接），改源码后需重新 `add` 刷新安装副本。

## 使用

打开 Web GUI → 右上角 **设置** → 左侧导航 **DIY 主题**，即可按分组调整：

| 分组 | 控件 | 说明 |
|---|---|---|
| 🎨 配色 | 主题模板 | 一键套用整套配色（品牌/强调/语义） |
| | 品牌/强调/成功/警告/错误 | 5 个取色器，带 hex 值显示 |
| 🔤 字体 | 界面字体 / 代码字体 | 下拉选择预设字体栈 |
| | 整体缩放 | 80–140%，整体放大缩小界面 |
| 🖼 背景 | 使用内置壁纸 | 开关内嵌壁纸 |
| | 上传背景图 | 选本地图片，前端压缩后应用 |
| | 背景 URL | 填网络图或 data URI |
| | 面板通透度 | 0–100%，越小背景越清楚 |
| | 毛玻璃强度 | 0–30px，0 为关闭模糊（最省性能） |
| 🧩 组件 | 圆角 | 0–24px，作用于按钮/输入/对话框等 |

改动实时生效并写入 localStorage（`dsh-ui-customizer:config:v3`），刷新后保留。

## 测试

```powershell
npm test
# 等价于：
node tools/test-client.cjs   # 无头测试：factory+apply+渲染+防抖+上传
node tools/test-render.cjs   # 真实 React 渲染测试
```

## 换壁纸

```powershell
npm run wallpaper -- "C:\path\to\image.png"
```

图片会被压成 1920px JPEG，写入 `assets/wallpaper.txt` 并内嵌进 `lib/client.js`，
然后重新 `add` + 重启。若只改了壁纸文件想重新内嵌：`node tools/inject-wallpaper.cjs`。

## 关键契约（跨 DSH 版本升级时核对）

- `exports` 必须暴露 `"./package.json"`：`client-modules` 靠 `require.resolve('<pkg>/package.json')`
  读取 `dsh.client` 声明，缺失会被判为「非客户端包」。
- 客户端 bundle 是 classic `<script>`，必须以 `window.__ModuleLoader__.load({...})` 注册 factory。
- `package.json` 的 `dsh.client` 需含 `{ platform: "web", immediately: true, inject: [...] }`。

## 目录结构

```
dsh-ui-customizer/
├── package.json          # exports["./client"] + dsh.client + peerDeps + scripts
├── install.ps1           # 一键安装
├── docs/                 # 截图（README 引用）
├── assets/wallpaper.txt  # 壁纸 data URI（set-wallpaper.cjs 生成）
├── tools/
│   ├── set-wallpaper.cjs    # 换壁纸（压缩 + 内嵌）
│   ├── inject-wallpaper.cjs # 仅重新内嵌 assets/wallpaper.txt
│   ├── test-client.cjs      # 无头测试
│   └── test-render.cjs      # 真实 React 渲染测试
└── lib/
    ├── index.js          # 宿主侧 no-op 入口
    └── client.js         # 浏览器 bundle：设置面板 + 主题 + CSS
```
