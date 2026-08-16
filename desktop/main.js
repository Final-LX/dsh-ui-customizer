// DSH 桌面客户端（Electron 主进程）
// 职责：本地起 `dsh web` 服务 → 等它就绪（解析 "dsh web: http://127.0.0.1:<port>"）→
//       开原生窗口指向它 → 窗口关闭/退出时回收服务进程。
const { app, BrowserWindow } = require("electron");
const { spawn, execSync } = require("node:child_process");

const PROFILE = process.env.DSH_PROFILE || "web";   // 复用已有 web profile（已装 dsh-ui-customizer）
// 注意：必须用固定端口，不能用 --port 0！
// localStorage 和 IndexedDB 都按 origin（含端口）隔离；端口一变 = 换了 origin =
// 主题配置、上传的图片/视频、保存的方案全部“消失”。固定端口才能跨启动持久。
// 用 3099 而非浏览器常用的 3080，避免和正在跑的浏览器版 dsh 抢端口。
const PORT = process.env.DSH_PORT || "3099";
const START_TIMEOUT_MS = 60000;

let child = null;
let win = null;
let webUrl = null;

function startServer() {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === "win32";
    // npx 在 Windows 是 npx.cmd，用 shell 交给 cmd 解析；--yes 避免首次未安装时卡在交互确认
    child = spawn("npx", ["--yes", "@deepseek-ai/dsh", "web", "--profile", PROFILE, "--port", PORT], {
      shell: isWin,
      windowsHide: true,
      env: { ...process.env }
    });

    let buf = "";
    const timer = setTimeout(() => {
      reject(new Error("DSH 启动超时（60s）。请确认已安装 @deepseek-ai/dsh，且 profile \"" + PROFILE + "\" 存在。"));
    }, START_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      buf += chunk.toString();
      const m = /dsh web:\s*(https?:\/\/127\.0\.0\.1:\d+)/.exec(buf);
      if (m && !webUrl) {
        webUrl = m[1];
        clearTimeout(timer);
        resolve(webUrl);
      }
    });
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.on("error", (err) => { clearTimeout(timer); reject(err); });
    child.on("exit", () => {
      child = null;
      if (win && !win.isDestroyed()) win.close();
    });
  });
}

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
      sandbox: true
    }
  });
  win.loadURL(webUrl);
  win.on("closed", () => { win = null; });
}

function shutdown() {
  if (!child) return;
  try {
    if (process.platform === "win32") {
      // Windows 上 kill 单个进程不会带走子进程，用 taskkill /T 杀整棵树
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  } catch (e) { /* 忽略：进程可能已退出 */ }
  child = null;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      await startServer();
      createWindow();
    } catch (err) {
      console.error("启动失败：", err && err.message ? err.message : err);
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    shutdown();
    app.quit(); // 非 macOS 语义：全部窗口关闭即退出
  });

  app.on("before-quit", shutdown);
}
