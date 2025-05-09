const fs = require("fs");
const path = require("path");
const escpos = require("escpos");
const Pusher = require("pusher-js/node");
const os = require("os");

// Load printer connection modules
escpos.Network = require("escpos-network");
escpos.USB = require('escpos-usb');
// Load settings
let defaultSettings = {
  printerType: "lan",
  ip: "192.168.0.100",
  printerPort: 9100,
};

let sendLog = (message, mainWindow, isUIMessage = null) => {
  const currentDate = new Date();
  const formattedDate = currentDate
    .toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
    .replace(",", "");
  const entry = `[${formattedDate}] ${message}\n`;

  try {
    const logDir = path.join(os.homedir(), "Documents", "POS Printer Logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logPath = path.join(logDir, "logs.txt");
    fs.appendFileSync(logPath, entry);
  } catch (err) {
    console.error("Failed to write log:", err);
  }

  // Automatically determine if message should be shown in UI
  if (isUIMessage === null) {
    const importantPhrases = [
      "✅",
      "❌",
      "🛑",
      "🖨️",
      "📨",
      "🔌",
      "❗",
      "Ready to receive",
    ];
    isUIMessage = importantPhrases.some((icon) => message.includes(icon));
  }

  if (mainWindow && mainWindow.webContents && isUIMessage) {
    mainWindow.webContents.send("update-log", entry);
  }

  console.log(message);
};

// Log print action
function logPrint(content, mainWindow) {
  sendLog(`🖨️ Printed:\n${content}`, mainWindow, true); // Send only to UI if needed
}

const printQueue = [];
let isPrinting = false;

function enqueuePrint(data, mainWindow, retryCount = 0) {
  printQueue.push({ ...data, retryCount });
  processPrintQueue(mainWindow);
}

function processPrintQueue(mainWindow) {
  if (isPrinting || printQueue.length === 0) return;

  const nextJob = printQueue.shift();
  isPrinting = true;

  handlePrint(
    nextJob,
    (shouldRetry = false) => {
      isPrinting = false;
      if (shouldRetry && nextJob.retryCount < 3) {
        sendLog(`🔁 Retrying job (${nextJob.retryCount + 1}/3)...`, mainWindow, true);
        enqueuePrint(nextJob, mainWindow, nextJob.retryCount + 1); // Add job back to the queue for retry
      }

      processPrintQueue(mainWindow);  // Immediately process next job even if the current one is being retried
    },
    mainWindow
  );
}

function handlePrint({ text, printerType, ip, printerPort, retryCount = 0 }, done, mainWindow) {
  printerType = printerType || defaultSettings.printerType;
  ip = ip || defaultSettings.ip;
  printerPort = printerPort || defaultSettings.printerPort;

  if (!text) {
    sendLog("❌ Missing text to print.", mainWindow, true);
    if (done) done(false);
    return;
  }
  sendLog("🧾 Printing content:\n" + text, mainWindow, true);

  let device;
  try {
    if (printerType === "usb") {
      sendLog("USB Print", mainWindow, true);
      try {
        device = new escpos.USB();
        sendLog("Using USB printer: "+ device.deviceDescriptor, mainWindow, true);
      } catch (usbErr) {
        sendLog("❌ USB printing not supported: " + usbErr, mainWindow, true);
        if (done) done(true);
        return;
      }
    } else if (printerType === "lan") {
      sendLog("IP Print", mainWindow, true);
      if (!ip || !printerPort) {
        sendLog("❌ Missing IP or port for LAN printer.", mainWindow, true);
        if (done) done(false);
        return;
      }
      device = new escpos.Network(ip, printerPort);
    } else {
      sendLog("❌ Unsupported printer type.", mainWindow, true);
      if (done) done(false);
      return;
    }

    const printer = new escpos.Printer(device);

    // Wrap device.open with a timeout of 5 seconds
    const openWithTimeout = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Printer connection timed out."));
      }, 5000);

      device.open((err) => {
        clearTimeout(timeout);
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    openWithTimeout
      .then(() => {
        try {
          printer
            .text(text)
            .cut()
            .close(() => {
              sendLog("✅ Printed successfully.", mainWindow, true);
              if (done) done(false);
            });
        } catch (printErr) {
          sendLog("🛑 Printing failed: " + printErr, mainWindow, true);
          try {
            if (device && typeof device.close === "function") {
              device.close();
            }
          } catch (closeErr) {
            sendLog("Error closing device: " + closeErr, mainWindow, true);
          }
          if (done) done(true);
        }
      })
      .catch((err) => {
        sendLog("Printer connection failed: " + err, mainWindow, true);
        if (done) done(true);
      });
  } catch (err) {
    sendLog("Unexpected error: " + err, mainWindow, true);
    if (done) done(true);
  }
}

// Start server with mainWindow
function startServer(mainWindow) {
  console.log("Starting server...");
  mainWindow.webContents.send(
    "update-log",
    "[Init] Ready to receive print jobs." // Initial log sent to UI
  );
  // Setup Pusher inside startServer so it can use mainWindow
  const pusher = new Pusher("727d4c5680711508ffaa", {
    cluster: "ap2",
    encrypted: true,
  });

  const channel = pusher.subscribe("printer");

  channel.bind("App\\Events\\PrinterEvent", (data) => {
    sendLog("📨 Print request received.", mainWindow, true); // Send only necessary info
    enqueuePrint(data, mainWindow);
  });

  pusher.connection.bind("connected", () => {
    sendLog("🔌 Websocket connected.", mainWindow, true);
  });

  pusher.connection.bind("disconnected", () => {
    sendLog("🔌 Websocket disconnected.", mainWindow, true);
  });

  pusher.connection.bind("error", (err) => {
    sendLog("❗ Websocket connection error: " + err, mainWindow, true);
  });

  // Error handlers
  process.on("uncaughtException", (err) => {
    sendLog("Uncaught Exception: " + err, mainWindow, true);
  });

  process.on("unhandledRejection", (reason) => {
    sendLog("Unhandled Rejection: " + reason, mainWindow, true);
  });

  // Example periodic log
  setInterval(() => {
    sendLog("📢 Server is running...", mainWindow, false); // Send periodic log to console, not UI
  }, 10000);
}

module.exports.start = startServer;
