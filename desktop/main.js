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
const WEB_UI_PKG = "@linxin666/dsh-web-ui-all";     // 可选：全家桶（env DSH_WEB_UI=1 时安装）
const DS_HOME = process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
const LOG_FILE = path.join(DS_HOME, "desktop.log");
const ICON_PATH = path.join(__dirname, "assets", "icon.ico");

let serverChild = null;
let win = null;
let tray = null;
let splash = null;
let webUrl = null;
let ownsServer = false;   // 是否由本应用自己 spawn 的 DSH（复用的实例退出时不杀）
let quitting = false;   // 区分“用户退出”与“服务意外崩溃”

// ---------- 日志 ----------
function log(line) {
  const stamp = new Date().toISOString();
  const text = `[${stamp}] ${line}\n`;
  try {
    fs.mkdirSync(DS_HOME, { recursive: true });
    try {
      if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 5 * 1024 * 1024) {
        const rotated = LOG_FILE + ".1";
        try { fs.rmSync(rotated, { force: true }); } catch (e) {}
        fs.renameSync(LOG_FILE, rotated);
      }
    } catch (e) {}
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
    if (app && app.isPackaged) {
      throw new Error("安装包内置 DSH 运行时缺失，无法在离线模式启动");
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

function runDshSync(args, envOverride) {
  const r = spawnSync(runner.cmd, [...runner.prefix, ...args], {
    env: envOverride || runner.env,
    shell: runner.shell,
    encoding: "utf8",
    windowsHide: true
  });
  if (r.stdout && r.stdout.trim()) log("dsh 输出：\n" + r.stdout.trimEnd());
  if (r.stderr && r.stderr.trim()) log("dsh stderr：\n" + r.stderr.trimEnd());
  if (r.error) log("dsh spawn 错误：" + r.error.message);
  return r.status ?? (r.error ? 1 : 0);
}

// ---------- 首次引导（自包含：内置 pnpm + 内置插件，不依赖系统 node/npm/pnpm/git） ----------
const VENDOR_PLUGIN = path.join(__dirname, "vendor", "dsh-ui-customizer");
const PROFILE_PATCH_TEMPLATE = `# Your patch layer for this dsh profile, applied after every bundle layer:
# a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; \`!!js\` expressions allowed).
[]
`;
const PROFILE_PNPM_WORKSPACE = `packages:
  - .

nodeLinker: hoisted
autoInstallPeers: false
`;

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

// 复刻 dsh-app-boot 的 initProfile：新建 profile 缺一不可的三件套
function initProfileIfMissing() {
  const dir = path.join(DS_HOME, "profiles", PROFILE);
  fs.mkdirSync(dir, { recursive: true });
  const manifestPath = path.join(dir, "package.json");
  if (!fs.existsSync(manifestPath)) {
    fs.writeFileSync(manifestPath, JSON.stringify({
      name: `dsh-profile-${PROFILE}`,
      private: true,
      dependencies: {},
      // pnpm 9 用 onlyBuiltDependencies 放行原生构建（装 dsh-web-ui-all 等时需要）
      pnpm: { onlyBuiltDependencies: ["cloudflared", "cpu-features", "ssh2", "node-pty", "koffi", "esbuild"] },
      dsh: { profile: { bundles: ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"] } }
    }, null, 2) + "\n");
  }
  const patchPath = path.join(dir, "cordis.patch.yml");
  if (!fs.existsSync(patchPath)) fs.writeFileSync(patchPath, PROFILE_PATCH_TEMPLATE);
  const wsPath = path.join(dir, "pnpm-workspace.yaml");
  if (!fs.existsSync(wsPath)) fs.writeFileSync(wsPath, PROFILE_PNPM_WORKSPACE);
}

// 定位内置 pnpm 的 CLI 入口（exports 拦了 require.resolve，改用手动查找）
function findPnpmCli() {
  try { return require.resolve("pnpm/bin/pnpm.cjs"); } catch (e) {}
  const roots = [
    path.join(__dirname, "node_modules"),
    path.join(path.dirname(process.execPath), "resources", "app", "node_modules")
  ];
  for (const root of roots) {
    const direct = path.join(root, "pnpm", "bin", "pnpm.cjs");
    if (fs.existsSync(direct)) return direct;
    const pnpmDir = path.join(root, ".pnpm");
    if (fs.existsSync(pnpmDir)) {
      try {
        for (const d of fs.readdirSync(pnpmDir)) {
          if (d.startsWith("pnpm@")) {
            const p = path.join(pnpmDir, d, "node_modules", "pnpm", "bin", "pnpm.cjs");
            if (fs.existsSync(p)) return p;
          }
        }
      } catch (e2) {}
    }
  }
  return null;
}

// 用内置 pnpm（Electron 内嵌 Node 跑 pnpm.cjs）在 profile 里执行命令
function runBundledPnpm(args, cwd) {
  const pnpmCli = findPnpmCli();
  if (!pnpmCli) throw new Error("内置 pnpm 缺失，安装包可能不完整");
  const r = spawnSync(process.execPath, [pnpmCli, ...args], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    cwd, shell: false, encoding: "utf8", windowsHide: true
  });
  if (r.stdout && r.stdout.trim()) log("pnpm 输出：\n" + r.stdout.trimEnd());
  if (r.stderr && r.stderr.trim()) log("pnpm stderr：\n" + r.stderr.trimEnd());
  if (r.error) log("pnpm spawn 错误：" + r.error.message);
  return r.status ?? (r.error ? 1 : 0);
}

// 把随包内置的主题插件链到 $DSH_HOME/profiles/node_modules 兜底目录。
// npm 扁平布局下 DSH 的原生 internal 加载器正常工作，loader 会从 profile 的
// baseUrl 解析插件（走 internal.import(name, baseUrl)），所以插件必须落在
// profile 的解析链上——光在 harness 的 node_modules 里不够（profile 目录看不到）。
function linkBundledPluginIntoFallback() {
  const target = path.join(__dirname, "node_modules", "dsh-ui-customizer");
  if (!fs.existsSync(path.join(target, "package.json"))) {
    log("内置主题插件缺失，跳过链接：" + target);
    return;
  }
  const fallbackDir = path.join(DS_HOME, "profiles", "node_modules");
  fs.mkdirSync(fallbackDir, { recursive: true });
  const linkPath = path.join(fallbackDir, "dsh-ui-customizer");
  try {
    if (fs.realpathSync(linkPath) === fs.realpathSync(target)) return; // 已正确链好
  } catch (e) {}
  try { fs.rmSync(linkPath, { recursive: true, force: true }); } catch (e) {}
  try {
    fs.symlinkSync(target, linkPath, "junction");
    log(`已链入内置插件：${linkPath} -> ${target}`);
  } catch (e) {
    log(`链接内置插件失败（junction），改直接复制：${e.message}`);
    try {
      fs.cpSync(target, linkPath, { recursive: true });
      log(`已复制内置插件到：${linkPath}`);
    } catch (e2) {
      log(`复制内置插件也失败：${e2.message}`);
    }
  }
}

// 幂等：profile 三件套缺失则建；内置主题插件链入 profile 兜底目录；loader 缺则登记
function ensureProfile() {
  initProfileIfMissing();
  const profileDir = path.join(DS_HOME, "profiles", PROFILE);
  const patchPath = path.join(profileDir, "cordis.patch.yml");
  if (process.env.DSH_WEB_UI === "1" && !isPluginInstalled(WEB_UI_PKG)) {
    log(`引导 profile "${PROFILE}"：安装 ${WEB_UI_PKG} ...`);
    const code2 = runBundledPnpm(["add", "-w", WEB_UI_PKG], profileDir);
    if (code2 !== 0) throw new Error(`安装 ${WEB_UI_PKG} 失败（exit ${code2}）。详情见日志 ${LOG_FILE}`);
  }
  registerLoader(patchPath);
  linkBundledPluginIntoFallback();
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

function startServer(existingDsh) {
  return new Promise(async (resolve, reject) => {
    // 已有 DSH 实例在跑 → 直接复用，不重复起服务。
    // 传入布尔值时使用启动阶段已经完成的探测结果，避免探测后端口被占用的竞态；
    // 崩溃恢复未传参时仍会重新探测。
    const reuseExisting = typeof existingDsh === "boolean"
      ? existingDsh
      : await probeExistingDsh();
    if (reuseExisting) {
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
      // 启动竞态：探测后端口被其他 DSH 抢先监听时，改为复用那个实例。
      if (!gotUrl && !settled && /EADDRINUSE|address already in use/i.test(errBuf)) {
        probeExistingDsh().then((found) => {
          if (found && !settled) {
            settled = true;
            clearTimeout(timer);
            ownsServer = false;
            webUrl = `http://127.0.0.1:${PORT}`;
            log(`检测到启动竞态中的已有 DSH 实例 ${webUrl}，改为复用`);
            resolve(webUrl);
          } else if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(new Error("DSH 进程提前退出（code=" + code + "）。stderr：" + (errBuf.slice(0, 800) || "（空）") + "\n日志：" + LOG_FILE));
          }
        });
      // 启动阶段就退出 → 立即报错，不等 60s
      } else if (!gotUrl && !settled) {
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
// 启动阶段的小启动画面：profile 初始化 + DSH 服务就绪约 2 秒，期间给个“正在启动”的等待提示
function createSplash() {
  splash = new BrowserWindow({
    width: 420,
    height: 260,
    frame: false,
    resizable: false,
    movable: true,
    center: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: "#111318",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  splash.loadFile(path.join(__dirname, "splash.html"));
  splash.once("ready-to-show", () => { if (splash) splash.show(); });
}

function closeSplash() {
  if (splash) { try { splash.close(); } catch (e) {} splash = null; }
}

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
          position: fixed; top: 0; left: 0; width: 96px; height: 36px; z-index: 2147483647;
          display: flex; align-items: center;
          background: transparent;
           pointer-events: none;
          border-bottom: none;
          -webkit-app-region: drag;
          padding: 0 12px; box-sizing: border-box;
        }
        #__ds_titlebar .__ds_traffic { display: flex; gap: 8px; pointer-events: auto; -webkit-app-region: no-drag; }
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
        body { padding-top: 0 !important; box-sizing: border-box !important; }
        #root { min-height: 100% !important; margin: 0 !important; }
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
      createSplash();
      const existingDsh = await probeExistingDsh();
      if (existingDsh) {
        log(`启动前发现已有 DSH 实例 ${PORT}，不修改外部 profile`);
      } else {
        ensureProfile();
      }
      await startServer(existingDsh);
      createWindow();
      closeSplash();
      createTray();
      // 打包版检查更新（electron-updater，需配合 build.publish 与 GH_TOKEN）
      if (app.isPackaged) {
        try {
          const { autoUpdater } = require("electron-updater");
          autoUpdater.checkForUpdatesAndNotify().catch(() => {});
        } catch (e) { log("检查更新失败：" + (e && e.message ? e.message : e)); }
      }
    } catch (err) {
      closeSplash();
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
