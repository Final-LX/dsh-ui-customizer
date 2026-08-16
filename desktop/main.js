// DSH 桌面客户端（Electron 主进程）
//
// 职责链：解析 DSH 运行器（优先用 Electron 内嵌 Node，打包后无需系统 node/npx）
//   → 首次引导（确保 profile 存在 + 插件已装 + loader 已登记）
//   → 固定端口起 `dsh web` → 解析就绪地址 → 开窗口
//   → 日志落盘 + 崩溃恢复 + 托盘。
const { app, BrowserWindow, Tray, Menu, nativeImage, dialog, shell } = require("electron");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// ---------- 配置 ----------
const PROFILE = process.env.DSH_PROFILE || "web";   // 复用 web profile（含 web-app 模板）
// 必须固定端口：localStorage / IndexedDB 按 origin（含端口）隔离，端口一变数据就“消失”。
// 用 3099 避开浏览器常用的 3080，防止和浏览器版 dsh 抢端口。
const PORT = process.env.DSH_PORT || "3099";
const START_TIMEOUT_MS = 60000;
const CUSTOMIZER_URL = "git+https://github.com/Final-LX/dsh-ui-customizer";
const WEB_UI_PKG = "@linxin666/dsh-web-ui-all";     // 可选：全家桶（env DSH_WEB_UI=1 时安装）
const DS_HOME = process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
const LOG_FILE = path.join(DS_HOME, "desktop.log");
const ICON_PATH = path.join(__dirname, "assets", "icon.png");

let serverChild = null;
let win = null;
let tray = null;
let webUrl = null;
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
// 优先用 Electron 内嵌 Node 直接跑 @deepseek-ai/dsh/lib/bin.js（打包后无系统 node/npx）；
// 解析不到时回退到系统 npx（dev 模式）。
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

// 幂等：profile 已初始化、插件已装、loader 已登记时是 no-op
function ensureProfile() {
  const patchPath = path.join(DS_HOME, "profiles", PROFILE, "cordis.patch.yml");
  log(`引导 profile "${PROFILE}"（首次可能需要几分钟，含 pnpm 安装/原生构建）...`);
  const add1 = runDshSync(["plugin", "--profile", PROFILE, "add", CUSTOMIZER_URL]);
  if (add1 !== 0) throw new Error(`安装 ${CUSTOMIZER_URL} 失败（exit ${add1}）`);
  if (process.env.DSH_WEB_UI === "1") {
    const add2 = runDshSync(["plugin", "--profile", PROFILE, "add", WEB_UI_PKG]);
    if (add2 !== 0) throw new Error(`安装 ${WEB_UI_PKG} 失败（exit ${add2}）`);
  }
  registerLoader(patchPath);
}

// ---------- 服务启动 ----------
function startServer() {
  return new Promise((resolve, reject) => {
    const args = ["web", "--profile", PROFILE, "--port", PORT];
    serverChild = spawn(runner.cmd, [...runner.prefix, ...args], {
      env: runner.env,
      windowsHide: true,
      shell: runner.shell
    });

    let buf = "";
    const timer = setTimeout(() => {
      reject(new Error("DSH 启动超时（60s）。见日志 " + LOG_FILE));
    }, START_TIMEOUT_MS);

    serverChild.stdout.on("data", (chunk) => {
      buf += chunk.toString();
      log(chunk.toString().trimEnd());
      const m = /dsh web:\s*(https?:\/\/127\.0\.0\.1:\d+)/.exec(buf);
      if (m && !webUrl) {
        webUrl = m[1];
        clearTimeout(timer);
        resolve(webUrl);
      }
    });
    serverChild.stderr.on("data", (chunk) => log("[stderr] " + chunk.toString().trimEnd()));
    serverChild.on("error", (err) => { clearTimeout(timer); reject(err); });
    serverChild.on("exit", (code) => {
      serverChild = null;
      log(`dsh 进程退出 code=${code}`);
      if (!quitting && win && !win.isDestroyed()) {
        // 服务意外崩溃 → 弹窗让用户选重启/退出
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
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  win.loadURL(webUrl);
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
  try {
    if (process.platform === "win32") {
      require("node:child_process").execSync(`taskkill /pid ${serverChild.pid} /T /F`, { stdio: "ignore" });
    } else {
      serverChild.kill("SIGTERM");
    }
  } catch (e) { /* 进程可能已退出 */ }
  serverChild = null;
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
