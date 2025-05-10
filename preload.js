const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  onLogUpdate: (callback) => ipcRenderer.on("update-log", (event, message) => callback(message))
});