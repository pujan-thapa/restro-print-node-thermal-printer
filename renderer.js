window.electronAPI.onLogUpdate((message) => {
  const logContainer = document.getElementById("logContainer"); // <- Corrected ID
  if (logContainer) {
    const p = document.createElement("div");
    p.textContent = message;
    logContainer.appendChild(p);
    logContainer.scrollTop = logContainer.scrollHeight;
  }
});
document.getElementById("listBtn").addEventListener("click", async () => {
  const printers = await window.electronAPI.listUsbPrinters();
  const printerList = document.getElementById("printerList");
  printerList.innerHTML = ""; // Clear previous

  if (printers.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No USB printers found.";
    printerList.appendChild(li);
  } else {
    printers.forEach((printer) => {
      const li = document.createElement("li");
      li.innerHTML = `
      🖨️ <span class="label">${
        printer.product || printer.manufacturer || "Unknown"
      }</span>
      <span class="details">(Vendor: ${printer.vendorId}, Product: ${
        printer.productId
      }, Serial Number: ${printer.serialNumber || "N/A"})</span>
    `;
      printerList.appendChild(li);
    });
  }
});
document.getElementById("clearLogs").addEventListener("click", async () => {
  const logContainer = document.getElementById("logContainer");
  logContainer.innerHTML = "";
});
document.getElementById("clearPrinters").addEventListener("click", async () => {
  const printerList = document.getElementById("printerList");
  printerList.innerHTML = "";
});
