const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  onLogUpdate: (callback) => ipcRenderer.on("update-log", (event,message) => callback(message)),
  onRequestConfig: (callback) => ipcRenderer.on("request-config", callback),
  submitConfig: (data) => ipcRenderer.send("submit-config", data),
});
