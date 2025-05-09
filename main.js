const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const server = require("./server.js");

let mainWindow = null;

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
const usb = require("usb");

ipcMain.handle("list-usb-printers", async () => {
  try {
    const devices = usb.getDeviceList();
    const printerDevices = [];

    for (const device of devices) {
      try {
        device.open(); // Required to access string descriptors
        const descriptor = device.deviceDescriptor;
        // const isPrinter = device.interfaces.some(
        //   (iface) => [7, 255].includes(iface.descriptor.bInterfaceClass)
        // );
        // if (isPrinter) {
          let manufacturer = null;
          let product = null;
          let serialNumber = null;

          // Fetch strings if available
          if (descriptor.iManufacturer) {
            manufacturer = await new Promise((resolve) =>
              device.getStringDescriptor(
                descriptor.iManufacturer,
                (err, data) => resolve(err ? null : data)
              )
            );
          }

          if (descriptor.iProduct) {
            product = await new Promise((resolve) =>
              device.getStringDescriptor(descriptor.iProduct, (err, data) =>
                resolve(err ? null : data)
              )
            );
          }

          if (descriptor.iSerialNumber) {
            serialNumber = await new Promise((resolve) =>
              device.getStringDescriptor(
                descriptor.iSerialNumber,
                (err, data) => resolve(err ? null : data)
              )
            );
          }
          product = product || `Product 0x${descriptor.idProduct.toString(16)}`;
          manufacturer = manufacturer || `Vendor 0x${descriptor.idVendor.toString(16)}`;
          printerDevices.push({
            vendorId: descriptor.idVendor,
            productId: descriptor.idProduct,
            manufacturer,
            product,
            serialNumber: serialNumber || null,
          });
        // }
        device.close();
      } catch (e) {
        console.warn("Failed to check USB device", e);
      }
    }

    return printerDevices;
  } catch (err) {
    console.error("Failed to list USB printers", err);
    return [];
  }
});
app.whenReady().then(() => {
  createWindow();
  server.start(mainWindow);
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
