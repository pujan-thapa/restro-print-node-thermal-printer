const fs = require("fs");
const path = require("path");
const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;
const Pusher = require("pusher-js/node");
const os = require("os");

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
  sendLog(`🖨️ Printed:\n${content}`, mainWindow, true);
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
        sendLog(
          `🔁 Retrying job (${nextJob.retryCount + 1}/3)...`,
          mainWindow,
          true
        );
        enqueuePrint(nextJob, mainWindow, nextJob.retryCount + 1);
      }

      processPrintQueue(mainWindow);
    },
    mainWindow
  );
}

async function handlePrint(
  { text, printerType, ip, printerPort, retryCount = 0 },
  done,
  mainWindow
) {
  printerType = printerType || defaultSettings.printerType;
  ip = ip || defaultSettings.ip;
  printerPort = printerPort || defaultSettings.printerPort;

  if (!text) {
    sendLog("❌ Missing text to print.", mainWindow, true);
    if (done) done(false);
    return;
  }
  sendLog("🧾 Printing content:\n" + text, mainWindow, true);

  let printer;

  try {
    if (printerType === "lan") {
      if (!ip || !printerPort) {
        sendLog("❌ Missing IP or port for LAN printer.", mainWindow, true);
        if (done) done(false);
        return;
      }

      // Correct initialization for network printer in v4.4.5
      printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: `tcp://${ip}:${printerPort}`,
      });
    } else {
      sendLog("❌ Unsupported printer type.", mainWindow, true);
      if (done) done(false);
      return;
    }

    // Print the document
    try {
      printer.println(text);
      printer.cut();
      await printer.execute();
      sendLog("✅ Printed successfully.", mainWindow, true);
      if (done) done(false); // Success
    } catch (err) {
      sendLog(
        `🛑 Printing failed: ${err.message}\nStack trace: ${err.stack}`,
        mainWindow,
        true
      );
      if (done) done(true); // Failed
    }
  } catch (err) {
    sendLog(
      `Unexpected error: ${err.message}\nStack trace: ${err.stack}`,
      mainWindow,
      true
    );
    if (done) done(true); // Failed
  }
}

// Start server with mainWindow
function startServer(mainWindow) {
  console.log("Starting server...");
  mainWindow.webContents.send(
    "update-log",
    "[Init] Ready to receive print jobs."
  );

  // Setup Pusher inside startServer so it can use mainWindow
  const pusher = new Pusher("727d4c5680711508ffaa", {
    cluster: "ap2",
    encrypted: true,
  });

  const channel = pusher.subscribe("printer");

  channel.bind("App\\Events\\PrinterEvent", (data) => {
    sendLog("📨 Print request received.", mainWindow, true);
    enqueuePrint(data, mainWindow);
  });

  pusher.connection.bind("connected", () => {
    sendLog("🔌 Websocket connected.", mainWindow, true);
  });

  pusher.connection.bind("disconnected", () => {
    sendLog("🔌 Websocket disconnected.", mainWindow, true);
  });

  pusher.connection.bind("error", (err) => {
    sendLog(
      "❗ Websocket connection error: " + JSON.stringify(err),
      mainWindow,
      true
    );
  });

  // Error handlers
  process.on("uncaughtException", (err) => {
    sendLog("Uncaught Exception: " + JSON.stringify(err), mainWindow, true);
  });

  process.on("unhandledRejection", (reason) => {
    sendLog("Unhandled Rejection: " + JSON.stringify(reason), mainWindow, true);
  });

}

module.exports.start = startServer;
