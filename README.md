<p align="center">
  <img src="https://img.shields.io/badge/DSH-UI%20Customizer-4f46e5?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEyIDJMMTIuNSAxMC41IDIxIDExIDIxIDEyLjUgMTIuNSAxMyAxMiAyMiAxMC41IDEzIDIgMTIuNSAyIDExIDEwLjUgMTAuNSAxMiAyWiIvPjwvc3ZnPg=="/>
  <img src="https://img.shields.io/badge/platform-web-blue?style=flat-square"/>
  <a href="https://github.com/Final-LX/dsh-ui-customizer/blob/main/README.md"><img src="https://img.shields.io/badge/lang-English-blue?style=flat-square"/></a>
  <a href="https://github.com/Final-LX/dsh-ui-customizer/blob/main/README.zh-CN.md"><img src="https://img.shields.io/badge/lang-简体中文-red?style=flat-square"/></a>
  <a href="https://github.com/Final-LX/dsh-ui-customizer/blob/main/README.zh-TW.md"><img src="https://img.shields.io/badge/lang-繁體中文-orange?style=flat-square"/></a>
  <a href="https://github.com/Final-LX/dsh-ui-customizer/blob/main/README.ja.md"><img src="https://img.shields.io/badge/lang-日本語-green?style=flat-square"/></a>
  <img src="https://img.shields.io/badge/tests-passing-brightgreen?style=flat-square"/>
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square"/>
</p>

<p align="center">
  <strong>dsh-ui-customizer</strong> — a visual, no-code theme customizer for
  <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness (DSH)</a> Web.
  Change colors, fonts, background and component style from the <em>Settings → DIY Theme</em> panel and watch it apply instantly.
</p>

---

**Languages:** [English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md)

---

## ✨ Features

| Group | What you can change | Notes |
|---|---|---|
| **Master switch** | Enable / disable the DIY theme | Turning it off removes every override |
| **Skin center** | 8 one-click presets | You can keep fine-tuning after picking a preset |
| **Colors** | Brand, accent, success, warning, error | Color picker + hex |
| **Colors** | Neutral tone direction | Blue‑grey, cool grey, warm grey, graphite |
| **Fonts** | UI font and code font | Preset font stacks |
| **Fonts** | Overall zoom (80–140%) and text scale (80–130%) | Two independent controls |
| **Background** | Image URL (`http(s):` or `data:`) | Kept in the browser |
| **Background** | Panel translucency & glass blur | High values cost more GPU/CPU |
| **Components** | Shadow level and border radius | Adjust depth and roundness |
| **My schemes** | Save & switch full theme presets | Name your setups and recall them |

> The plugin is **readability‑first**: environment surfaces (main background, sidebar) become transparent with your translucency setting, while overlays (dialogs, menus, inputs, tooltips) stay ~94% opaque so text inside pop‑ups always remains readable.

## 🚀 Quick Start

> You need **Node.js** (with `npx`) to run a DSH Web profile. No git or pnpm is required for the simplest path.

### Option A — install script (only Node.js needed)

1. Download this repo as a **ZIP** and extract it.
2. In PowerShell, `cd` into the extracted folder and run:

   ```powershell
   .\install-web.ps1
   ```

3. Start DSH Web:

   ```powershell
   npx @deepseek-ai/dsh web
   ```

4. Open **Settings → DIY Theme** in the browser.

The script copies the plugin into `~\.dsh\profiles\web\node_modules\dsh-ui-customizer` and registers it in `cordis.patch.yml`. It is safe to re‑run.

> **Execution policy error?** If PowerShell says the script "cannot be loaded / is not digitally signed", that is the default execution policy blocking an unsigned script. Bypass it for just this window (safe, resets when the window closes):
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> .\install-web.ps1
> ```
> or run it in one line:
> ```powershell
> powershell -ExecutionPolicy Bypass -File .\install-web.ps1
> ```

### Option B — DSH plugin command (git + pnpm available)

```powershell
dsh plugin --profile web add "git+https://github.com/Final-LX/dsh-ui-customizer"
```

If `dsh` is not on your PATH:

```powershell
npx @deepseek-ai/dsh plugin --profile web add "git+https://github.com/Final-LX/dsh-ui-customizer"
```

`dsh plugin add` only installs the dependency — this plugin is a classic bundle
(activated via a loader row, not `dsh.bundle`), so you **must** register the loader
manually for it to appear. Edit:

```text
%USERPROFILE%\.dsh\profiles\web\cordis.patch.yml
```

Make sure it contains:

```yaml
- insert:
    - id: ui-customizer
      name: dsh-ui-customizer
```

Then **fully restart** DSH Web (`npx @deepseek-ai/dsh web`) and refresh the page.
If you only run `dsh plugin add` without the loader row, the panel will not show up.

## 🤖 Install via AI (copy & paste)

Prefer to let an AI agent (e.g. DeepSeek Harness, Claude, ChatGPT) set it up for you?
Copy one of the prompts below and paste it to your AI. Both are self-contained.

**English prompt:**

```text
Help me install the dsh-ui-customizer theme plugin into my DeepSeek Harness (DSH) Web.
Steps:
1. Make sure I have Node.js (with npx).
2. Start DSH Web with: npx @deepseek-ai/dsh web  (this initializes the "web" profile on first run).
3. Install the plugin from git:  npx @deepseek-ai/dsh plugin --profile web add "git+https://github.com/Final-LX/dsh-ui-customizer"
4. This plugin is a classic bundle (no dsh.bundle), so dsh plugin add will NOT activate it on its own.
   Open %USERPROFILE%\.dsh\profiles\web\cordis.patch.yml and make sure it contains:
     - insert:
         - id: ui-customizer
           name: dsh-ui-customizer
5. Fully restart DSH Web (stop and run "npx @deepseek-ai/dsh web" again), then refresh the browser.
6. Open Settings -> DIY Theme to confirm the panel appears.
If anything fails, show me the error and the contents of cordis.patch.yml, and tell me how to fix it.
```

**中文提示词：**

```text
帮我把 dsh-ui-customizer 主题插件安装到 DeepSeek Harness（DSH）Web 里。
步骤：
1. 确认本机已装 Node.js（含 npx）。
2. 启动 DSH Web：npx @deepseek-ai/dsh web（首次运行会初始化 web profile）。
3. 从 git 安装插件：npx @deepseek-ai/dsh plugin --profile web add "git+https://github.com/Final-LX/dsh-ui-customizer"
4. 本插件是 classic bundle（没有 dsh.bundle），dsh plugin add 不会自动激活它。
   打开 %USERPROFILE%\.dsh\profiles\web\cordis.patch.yml，确认包含：
     - insert:
         - id: ui-customizer
           name: dsh-ui-customizer
5. 完全重启 DSH Web（先停掉，再跑 npx @deepseek-ai/dsh web），然后刷新浏览器。
6. 打开「设置 -> DIY 主题」确认面板出现。
如果失败，把报错和 cordis.patch.yml 的内容给我看，并告诉我怎么修。
```

## 🖼️ First run & how the panel works

1. Start DSH and finish the built‑in model / API‑key onboarding.
2. Open **Settings** (top‑right) → **DIY Theme**.
3. Everything you change is **previewed live** (“try on”).
4. Click **Apply** to save, **Revert** to undo unsaved changes, **Reset to default** to restore factory values.

## 🔒 Data, security & compatibility

- Your theme config and schemes are stored in **`localStorage`**; uploaded media (if any) live in **IndexedDB**. Nothing is uploaded to the DSH server.
- Remote image URLs load subject to the scheme, browser security policy, and the server's CORS / Referrer response.
- DSH is evolving quickly — official tokens, slots and page structure may change and affect compatibility. If a setting stops working after a DSH upgrade, re‑run the tests and report the mismatch.

## ❓ FAQ

**Why isn't my theme synced between browsers?**
Theme data belongs to the browser (localStorage/IndexedDB). Different browsers/profiles keep their own copy; DSH server session data is shared because it lives on the server.

**I changed something but nothing happened.**
Changes are applied on **Apply**. If even Apply has no effect, your DSH version may have drifted from the plugin's token set — update the plugin or report the token mismatch (see Troubleshooting).

**Can I share a scheme?**
Not directly — schemes are stored locally. You can `Export`… (via your browser's storage tools) or just note the color/scale values and recreate them.

## 🛠️ Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Panel missing after install | DSH not fully restarted, or the loader row is missing in `cordis.patch.yml`. Restart `dsh web` after editing, then refresh. |
| Theme applies but some colors look off | Official tokens changed across DSH versions. `npm test` (which runs `tools/test-tokens.cjs`) will surface the mismatch; file an issue with the listed tokens. |
| Heavy blur / large images feel slow | Lower panel translucency / glass strength, or use a smaller background image. |
| Background URL doesn't load | Check the URL scheme (`http(s)` only), and the remote server's CORS / Referrer policy. |

## 👩‍💻 For developers

```text
dsh-ui-customizer/
├── lib/client.js                 # browser-side classic bundle (theme logic + settings UI)
├── lib/index.js                  # host-side entry (no-op for this browser-only plugin)
├── package.json                  # plugin metadata + dsh.client config
├── tools/                        # tests
├── docs/                         # screenshots & introduction
├── install-web.ps1               # Node.js-only web install script
└── README.md                     # this file (+ other languages)
```

Run the tests:

```powershell
npm test
```

which runs `test-client`, `test-render`, `test-idb`, and `test-tokens`. The last one requires an installed `@deepseek-ai/dsh` (it compares the plugin's whitelisted tokens against the official dist CSS); with no DSH installed it is skipped rather than failing, so `npm test` always works. CI runs it against `latest` and a pinned version to catch token drift early.

Key plugin contracts:

- `package.json` must export `./package.json` so DSH can read `dsh.client`.
- The client bundle registers via `window.__ModuleLoader__.load({...})`.
- `dsh.client` declares `platform: "web"`, `immediately: true` and the `inject` services.

## 📄 License

[MIT](LICENSE) — © 2025 Final-LX. Contributions (issues, PRs, stars) are welcome!
