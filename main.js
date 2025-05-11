const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const WinReg = require("winreg");
const server = require("./server.js");

let mainWindow = null;

// Get registry value for appKey or cluster
async function getRegistryValue(name) {
  return new Promise((resolve) => {
    const regKey = new WinReg({
      hive: WinReg.HKCU,
      key: "\\Software\\RestroPrintElectron",
    });

    regKey.get(name, (err, item) => {
      if (err) {
        console.error(`Error reading registry for ${name}:`, err.message);
      }
      resolve(err || !item ? null : item.value);
    });
  });
}

// Set registry value for appKey or cluster
function setRegistryValue(name, value) {
  const regKey = new WinReg({
    hive: WinReg.HKCU,
    key: "\\Software\\RestroPrintElectron",
  });

  regKey.set(name, WinReg.REG_SZ, value, (err) => {
    if (err) {
      console.error(`Failed to set ${name}:`, err.message);
    }
  });
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
  let appKey = await getRegistryValue("appKey");
  let cluster = await getRegistryValue("cluster");

  // If no appKey or cluster, show modal to ask for values
  if (!appKey || !cluster) {
    mainWindow.webContents.send("request-config");
    return new Promise((resolve) => {
      pendingConfigResolve = resolve;
    });
  }

  // Return values if found in the registry
  return { appKey, cluster };
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

  ipcMain.on("print-log", (event, log) => {
    mainWindow.webContents.send("update-log", log);
  });
}

app.whenReady().then(async () => {
  createWindow();

  mainWindow.webContents.once("did-finish-load", async () => {
    const config = await checkOrRequestConfig();
    if (config.appKey && config.cluster) {
      server.start(mainWindow, config.appKey, config.cluster);
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
