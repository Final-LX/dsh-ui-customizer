// 预加载脚本：通过 contextBridge 暴露最小、受限的桌面能力。
// 渲染进程不获得 Node、fs 或完整 ipcRenderer，只能调用这里列出的白名单方法。
const { contextBridge, ipcRenderer } = require("electron");

// 窗口控制（原生标题栏由系统处理；此桥接保留给托盘/快捷键等潜在场景）
contextBridge.exposeInMainWorld("dshWin", {
  minimize: () => ipcRenderer.send("win:minimize"),
  toggleMaximize: () => ipcRenderer.send("win:toggle-maximize"),
  close: () => ipcRenderer.send("win:close")
});

// 桌面能力桥接：只读能力清单 + 受限的原生目录选择。
// pickDirectory 通过 ipcRenderer.invoke 走主进程 dialog.showOpenDialog，返回绝对路径或 null（取消）。
contextBridge.exposeInMainWorld("dshDesktop", {
  capabilities: Object.freeze({
    platform: process.platform,
    hasNativeDirectoryPicker: true
  }),
  pickDirectory: (title) => ipcRenderer.invoke("picker:pick-directory", { title })
});
