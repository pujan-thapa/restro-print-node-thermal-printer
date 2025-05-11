const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const server = require("./server.js");
const ElectronStore = require('electron-store');
const Store = ElectronStore.default || ElectronStore; // <-- safe fallback for both CJS and ESM
const store = new Store({ encryptionKey: '1qwd#$%sadwq12fdfe' });
let mainWindow = null;
// Get config value for appKey or cluster
async function getRegistryValue(name) {
  return store.get(name);
}

// Set config value for appKey or cluster
function setRegistryValue(name, value) {
  store.set(name, value);
}
let pendingConfigResolve = null;

// Handle config submission from renderer
ipcMain.on("submit-config", (event, data) => {
  const { appKey, cluster } = data;

  setRegistryValue("appKey", appKey);
  setRegistryValue("cluster", cluster);

  if (pendingConfigResolve) {
    pendingConfigResolve({ appKey, cluster });
    pendingConfigResolve = null;
  }
});
// Check for configuration in the registry
async function checkOrRequestConfig() {
  const appKey = await getRegistryValue("appKey");
  const cluster = await getRegistryValue("cluster");

  if (appKey && cluster) {
    return { appKey, cluster };
  }

  return new Promise((resolve) => {
    pendingConfigResolve = resolve;
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send("request-config");
    } else {
      resolve({ appKey: null, cluster: null }); // Fallback if window is not ready
    }
  });
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile("index.html");

  // Handle manual log requests
  ipcMain.on("print-log", (event, log) => {
    mainWindow.webContents.send("update-log", log);
  });
}
app.whenReady().then(() => {
  createWindow();
  mainWindow.webContents.once("did-finish-load", async () => {
    const config = await checkOrRequestConfig();
    if (config.appKey && config.cluster) {
      server.start(mainWindow, config.appKey, config.cluster);
    }
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});