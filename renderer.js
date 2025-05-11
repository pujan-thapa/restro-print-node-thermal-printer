window.addEventListener("DOMContentLoaded", () => {
  const logContainer = document.getElementById("logContainer");
  const clearLogsButton = document.getElementById("clearLogs");
  const configModal = document.getElementById("configModal");
  const inputAppKey = document.getElementById("inputAppKey");
  const inputCluster = document.getElementById("inputCluster");
  const submitBtn = document.getElementById("submitConfigBtn");

  window.electronAPI.onLogUpdate((message) => {
    if (logContainer) {
      const p = document.createElement("div");
      p.textContent = message;
      logContainer.appendChild(p);
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  });

  clearLogsButton?.addEventListener("click", () => {
    if (logContainer) logContainer.innerHTML = "";
  });

  // Show modal when the main process requests configuration
  window.electronAPI.onRequestConfig(() => {
    configModal.style.display = "flex"; // Show modal
  });

  // Handle config submission
  submitBtn?.addEventListener("click", () => {
    const appKey = inputAppKey?.value.trim();
    const cluster = inputCluster?.value.trim();
    if (appKey && cluster) {
      window.electronAPI.submitConfig({appKey, cluster});
      configModal.style.display = "none"; // Hide modal after submission
    } else {
      alert("Please enter both App Key and Cluster.");
    }
  });
});
