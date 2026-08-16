// 预加载脚本：向渲染进程暴露窗口控制（自定义标题栏按钮用）
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dshWin", {
  minimize: () => ipcRenderer.send("win:minimize"),
  toggleMaximize: () => ipcRenderer.send("win:toggle-maximize"),
  close: () => ipcRenderer.send("win:close")
});
