const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  printReceipt: (data) => ipcRenderer.invoke("print-receipt", data),
  installUpdate: () => ipcRenderer.send("install-update"),
  onUpdateAvailable: (callback) =>
    ipcRenderer.on("update-available", callback),
  onUpdateDownloaded: (callback) =>
    ipcRenderer.on("update-downloaded", callback),
});
