window.electronAPI.onLogUpdate((message) => {
  const logContainer = document.getElementById("logContainer"); // <- Corrected ID
  if (logContainer) {
    const p = document.createElement("div");
    p.textContent = message;
    logContainer.appendChild(p);
    logContainer.scrollTop = logContainer.scrollHeight;
  }
});

document.getElementById("clearLogs").addEventListener("click", async () => {
  const logContainer = document.getElementById("logContainer");
  logContainer.innerHTML = "";
});
