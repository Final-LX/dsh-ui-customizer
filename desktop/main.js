// DSH 桌面客户端（Electron 主进程）
//
// 职责链：解析 DSH 运行器（优先用 Electron 内嵌 Node，打包后无需系统 node/npx）
//   → 首次引导（确保 profile 存在 + 插件已装 + loader 已登记）
//   → 固定端口起 `dsh web` → 解析就绪地址 → 开窗口
//   → 日志落盘 + 崩溃恢复 + 托盘。
const { app, BrowserWindow, Tray, Menu, nativeImage, dialog, shell, ipcMain } = require("electron");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// 修复外部截图/录屏（OBS、Snipping Tool 等）捕获到窗口全白/高亮：
// 禁用 GPU 硬件加速，改用软件渲染（DSH 是 Web UI，软件渲染足够流畅）。
app.disableHardwareAcceleration();

// ---------- 配置 ----------
const PROFILE = process.env.DSH_PROFILE || "web";   // 复用 web profile（含 web-app 模板）
// 端口用 3080（与官方 `dsh web` 一致）：桌面端和网页端共用同一个 DSH 实例，
// 会话实时同步、也不会两个进程并发写同一份会话日志导致 Zstandard 记录撕裂。
const PORT = process.env.DSH_PORT || "3080";
const START_TIMEOUT_MS = 60000;
const CUSTOMIZER_URL = "git+https://github.com/Final-LX/dsh-ui-customizer";
const WEB_UI_PKG = "@linxin666/dsh-web-ui-all";     // 可选：全家桶（env DSH_WEB_UI=1 时安装）
const DS_HOME = process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
const LOG_FILE = path.join(DS_HOME, "desktop.log");
const ICON_PATH = path.join(__dirname, "assets", "icon.ico");

let serverChild = null;
let win = null;
let tray = null;
let webUrl = null;
let ownsServer = false;   // 是否由本应用自己 spawn 的 DSH（复用的实例退出时不杀）
let quitting = false;   // 区分“用户退出”与“服务意外崩溃”

// ---------- 日志 ----------
function log(line) {
  const stamp = new Date().toISOString();
  const text = `[${stamp}] ${line}\n`;
  try {
    fs.mkdirSync(DS_HOME, { recursive: true });
    fs.appendFileSync(LOG_FILE, text, "utf8");
  } catch (e) { /* 落盘失败不阻断 */ }
  if (!app.isPackaged) process.stdout.write(text);
}

// ---------- DSH 运行器 ----------
// 三级策略，避开 npx/cmd/shell 在 Electron 下 stdio 捕获不稳的坑：
//   1) 打包内嵌了 @deepseek-ai/dsh → 用 Electron 内嵌 Node 跑 bin.js
//   2) 本机 npx 缓存里有 @deepseek-ai/dsh → 用系统 node.exe 直接跑 bin.js
//   3) 回退 npx（需要 npx 在 PATH）
function findInPath(filename) {
  for (const dir of (process.env.PATH || "").split(";")) {
    if (!dir) continue;
    const p = path.join(dir, filename);
    try { if (fs.existsSync(p)) return p; } catch (e) {}
  }
  return null;
}

function findDshBinInNpxCache() {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  const cacheRoot = path.join(localAppData, "npm-cache", "_npx");
  try {
    if (!fs.existsSync(cacheRoot)) return null;
    for (const d of fs.readdirSync(cacheRoot)) {
      const bin = path.join(cacheRoot, d, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
      if (fs.existsSync(bin)) return bin;
    }
  } catch (e) {}
  return null;
}

function resolveDshRunner() {
  try {
    const bin = require.resolve("@deepseek-ai/dsh/lib/bin.js");
    return {
      cmd: process.execPath,
      prefix: [bin],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      shell: false
    };
  } catch (e) {
    const bin = findDshBinInNpxCache();
    if (bin) {
      const node = findInPath("node.exe") || "node";
      return { cmd: node, prefix: [bin], env: process.env, shell: false };
    }
    return {
      cmd: "npx",
      prefix: ["--yes", "@deepseek-ai/dsh"],
      env: process.env,
      shell: process.platform === "win32"
    };
  }
}
const runner = resolveDshRunner();

function runDshSync(args) {
  const r = spawnSync(runner.cmd, [...runner.prefix, ...args], {
    env: runner.env,
    stdio: "inherit",
    shell: runner.shell
  });
  return r.status ?? (r.error ? 1 : 0);
}

// ---------- 首次引导 ----------
function profileManifest() {
  const pkgPath = path.join(DS_HOME, "profiles", PROFILE, "package.json");
  try { return JSON.parse(fs.readFileSync(pkgPath, "utf8")); } catch (e) { return null; }
}
function isPluginInstalled(name) {
  const m = profileManifest();
  return !!(m && m.dependencies && m.dependencies[name] !== undefined);
}

function registerLoader(patchPath) {
  let content;
  try { content = fs.readFileSync(patchPath, "utf8"); } catch (e) { content = "[]\n"; }
  if (content.includes("dsh-ui-customizer")) return;
  const row = "- insert:\n    - id: ui-customizer\n      name: dsh-ui-customizer";
  if (/\[\]\s*$/.test(content)) content = content.replace(/\[\]\s*$/, row);
  else content = content.trimEnd() + "\n" + row + "\n";
  fs.writeFileSync(patchPath, content, "utf8");
  log(`cordis.patch.yml 已登记 loader（${patchPath}）`);
}

// 幂等：已安装/已登记时是 no-op（每次启动只做检查，不重复 pnpm add）
function ensureProfile() {
  const patchPath = path.join(DS_HOME, "profiles", PROFILE, "cordis.patch.yml");
  if (!isPluginInstalled("dsh-ui-customizer")) {
    log(`引导 profile "${PROFILE}"：安装 dsh-ui-customizer（首次可能需要几分钟）...`);
    const code = runDshSync(["plugin", "--profile", PROFILE, "add", CUSTOMIZER_URL]);
    if (code !== 0) throw new Error(`安装 ${CUSTOMIZER_URL} 失败（exit ${code}）`);
  }
  if (process.env.DSH_WEB_UI === "1" && !isPluginInstalled(WEB_UI_PKG)) {
    log(`引导 profile "${PROFILE}"：安装 ${WEB_UI_PKG} ...`);
    const code2 = runDshSync(["plugin", "--profile", PROFILE, "add", WEB_UI_PKG]);
    if (code2 !== 0) throw new Error(`安装 ${WEB_UI_PKG} 失败（exit ${code2}）`);
  }
  registerLoader(patchPath);
}

// ---------- 服务启动 ----------
// 探测端口上是否已有一个 DSH 实例（页面含 __DSH_BOOT__ 签名），有则复用，避免 EADDRINUSE
function probeExistingDsh() {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    let req;
    try {
      req = require("node:http").get(`http://127.0.0.1:${PORT}/`, { timeout: 3000 }, (res) => {
        let body = "";
        res.on("data", (c) => { body += c.toString(); if (body.length > 200000) res.destroy(); });
        res.on("end", () => finish(res.statusCode === 200 && body.includes("__DSH_BOOT__")));
      });
      req.on("error", () => finish(false));
      req.on("timeout", () => { req.destroy(); finish(false); });
    } catch (e) { finish(false); }
  });
}

function startServer() {
  return new Promise(async (resolve, reject) => {
    // 已有 DSH 实例在跑 → 直接复用，不重复起服务
    if (await probeExistingDsh()) {
      webUrl = `http://127.0.0.1:${PORT}`;
      ownsServer = false;
      log(`检测到已有 DSH 实例 ${webUrl}，直接复用`);
      resolve(webUrl);
      return;
    }

    ownsServer = true;
    const args = ["--profile", PROFILE, "--port", PORT];
    serverChild = spawn(runner.cmd, [...runner.prefix, ...args], {
      env: runner.env,
      windowsHide: true,
      shell: runner.shell
    });

    let buf = "";      // stdout + stderr 一起匹配（某些版本 URL 可能走 stderr）
    let errBuf = "";
    let settled = false;
    let gotUrl = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("DSH 启动超时（60s）。stderr：" + (errBuf.slice(0, 500) || "（空）") + "\n日志：" + LOG_FILE));
    }, START_TIMEOUT_MS);

    const onData = (chunk) => {
      buf += chunk.toString();
      const m = /dsh web:\s*(https?:\/\/127\.0\.0\.1:\d+)/.exec(buf);
      if (m && !settled) {
        settled = true;
        clearTimeout(timer);
        gotUrl = true;
        webUrl = m[1];
        resolve(webUrl);
      }
    };

    serverChild.stdout.on("data", (chunk) => { log(chunk.toString().trimEnd()); onData(chunk); });
    serverChild.stderr.on("data", (chunk) => { errBuf += chunk.toString(); log("[stderr] " + chunk.toString().trimEnd()); onData(chunk); });

    serverChild.on("error", (err) => { if (!settled) { settled = true; clearTimeout(timer); reject(err); } });

    serverChild.on("exit", (code) => {
      log(`dsh 进程退出 code=${code}`);
      // 启动阶段就退出 → 立即报错，不等 60s
      if (!gotUrl && !settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error("DSH 进程提前退出（code=" + code + "）。stderr：" + (errBuf.slice(0, 800) || "（空）") + "\n日志：" + LOG_FILE));
      }
      serverChild = null;
      // 运行期间（已就绪后）崩溃 → 弹窗让用户选重启/退出
      if (gotUrl && !quitting && win && !win.isDestroyed()) {
        const choice = dialog.showMessageBoxSync(win, {
          type: "error",
          buttons: ["重启服务", "退出"],
          defaultId: 0,
          title: "DSH 服务已停止",
          message: "DSH 服务意外退出了。"
        });
        if (choice === 0) { webUrl = null; startServer().then(() => win.loadURL(webUrl)).catch(() => app.quit()); }
        else app.quit();
      }
    });
  });
}

// ---------- 窗口 / 托盘 ----------
function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#111318",
    title: "DSH",
    icon: ICON_PATH,                    // 任务栏/Alt-Tab 窗口图标
    frame: false,                       // macOS 风格：自绘红绿灯，无系统标题栏
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  win.loadURL(webUrl);
  // 顶部一条 36px 标题栏，左上角 macOS 红绿灯（关闭/最小化/最大化），背景/边框跟随主题，无多余文字
  win.webContents.on("dom-ready", () => {
    try {
      win.webContents.insertCSS(`
        #__ds_titlebar {
          position: fixed; top: 0; left: 0; right: 0; height: 36px; z-index: 2147483647;
          display: flex; align-items: center;
          background: var(--dsw-alias-bg-base, #111318);
          border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.06));
          -webkit-app-region: drag;
          padding: 0 12px; box-sizing: border-box;
        }
        #__ds_titlebar .__ds_traffic { display: flex; gap: 8px; -webkit-app-region: no-drag; }
        #__ds_titlebar .__ds_traffic button {
          width: 12px; height: 12px; border-radius: 50%; border: none; padding: 0;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          font-size: 9px; line-height: 1; color: transparent; font-family: inherit;
        }
        #__ds_titlebar .__ds_traffic button:hover { color: rgba(0,0,0,.55); }
        #__ds_close { background: #ff5f57; }
        #__ds_min   { background: #febc2e; }
        #__ds_max   { background: #28c840; }

        html, body { height: 100%; }
        body { padding-top: 36px !important; box-sizing: border-box !important; overflow: hidden !important; }
        #root { height: 100% !important; margin: 0 !important; }
      `);
      win.webContents.executeJavaScript(`
        (function () {
          if (document.getElementById("__ds_titlebar")) return;
          var bar = document.createElement("div");
          bar.id = "__ds_titlebar";
          bar.innerHTML = '<span class="__ds_traffic">'
            + '<button id="__ds_close" title="关闭">×</button>'
            + '<button id="__ds_min" title="最小化">−</button>'
            + '<button id="__ds_max" title="最大化">+</button>'
            + '</span>';
          document.body.prepend(bar);
          document.getElementById("__ds_close").addEventListener("click", function () { window.dshWin.close(); });
          document.getElementById("__ds_min").addEventListener("click", function () { window.dshWin.minimize(); });
          document.getElementById("__ds_max").addEventListener("click", function () { window.dshWin.toggleMaximize(); });
        })();
      `).catch(() => {});
    } catch (e) {}
  });
  win.on("close", (e) => {
    if (!quitting && tray) {   // 关窗 = 最小化到托盘
      e.preventDefault();
      win.hide();
    }
  });
  win.on("closed", () => { win = null; });
}

function createTray() {
  let icon = nativeImage.createEmpty();
  try { if (fs.existsSync(ICON_PATH)) icon = nativeImage.createFromPath(ICON_PATH); } catch (e) {}
  tray = new Tray(icon);
  tray.setToolTip("DSH 桌面客户端");
  const menu = Menu.buildFromTemplate([
    { label: "显示窗口", click: () => { if (win) { win.show(); win.focus(); } } },
    { label: "刷新窗口", click: () => { if (win) { win.reload(); } } },
    { type: "separator" },
    { label: "打开日志", click: () => shell.openPath(LOG_FILE) },
    { label: "退出", click: () => { quitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
  tray.on("double-click", () => { if (win) { win.show(); win.focus(); } });
}

// ---------- 退出回收 ----------
function shutdown() {
  if (!serverChild) return;
  const child = serverChild;
  serverChild = null;
  // 只回收本应用自己 spawn 的 DSH；复用的网页端实例不杀，避免误伤正在用的会话
  if (!ownsServer) return;
  try {
    if (process.platform === "win32") {
      require("node:child_process").execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  } catch (e) { /* 进程可能已退出 */ }
}

// ---------- 生命周期 ----------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.setAppUserModelId("com.finallx.dsh-ui-desktop");
  app.on("second-instance", () => {
    if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
  });

  // macOS 风格红绿灯按钮的窗口控制
  ipcMain.on("win:minimize", () => { if (win) win.minimize(); });
  ipcMain.on("win:toggle-maximize", () => { if (!win) return; if (win.isMaximized()) win.unmaximize(); else win.maximize(); });
  ipcMain.on("win:close", () => { if (win) win.close(); });

  app.whenReady().then(async () => {
    log("==== 启动 ====");
    try {
      ensureProfile();
      await startServer();
      createWindow();
      createTray();
      // 打包版检查更新（electron-updater，需配合 build.publish 与 GH_TOKEN）
      if (app.isPackaged) {
        try {
          const { autoUpdater } = require("electron-updater");
          autoUpdater.checkForUpdatesAndNotify().catch(() => {});
        } catch (e) { log("检查更新失败：" + (e && e.message ? e.message : e)); }
      }
    } catch (err) {
      log("启动失败：" + (err && err.message ? err.message : err));
      dialog.showErrorBox("启动失败", (err && err.message ? err.message : String(err)) + "\n\n日志：" + LOG_FILE);
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    // 有托盘时不退出（关窗已最小化到托盘）；无托盘才退出
    if (!tray) { quitting = true; shutdown(); app.quit(); }
  });

  app.on("before-quit", () => { quitting = true; shutdown(); });
}
