const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getPrinters: () => ipcRenderer.invoke("get-printers"),
  printReceipt: (data) => ipcRenderer.invoke("print-receipt", data),
  saveReceiptPdf: (data) => ipcRenderer.invoke("save-receipt-pdf", data),
  openWhatsApp: (data) => ipcRenderer.invoke("open-whatsapp", data),
  installUpdate: () => ipcRenderer.send("install-update"),
  getUpdateState: () => ipcRenderer.invoke("get-update-state"),
  onUpdateAvailable: (callback) =>
    ipcRenderer.on("update-available", callback),
  onDownloadProgress: (callback) =>
    ipcRenderer.on("download-progress", (_e, percent) => callback(percent)),
  onUpdateDownloaded: (callback) =>
    ipcRenderer.on("update-downloaded", callback),
  onUpdateError: (callback) =>
    ipcRenderer.on("update-error", (_e, msg) => callback(msg)),
  setFullscreen: (value) => ipcRenderer.invoke("set-fullscreen", value),
  isFullscreen: () => ipcRenderer.invoke("is-fullscreen"),
  // Customer display
  updateCustomerDisplay: (data) => ipcRenderer.send("customer-display-update", data),
  openCustomerDisplay: () => ipcRenderer.invoke("open-customer-display"),
  closeCustomerDisplay: () => ipcRenderer.invoke("close-customer-display"),
  isCustomerDisplayOpen: () => ipcRenderer.invoke("is-customer-display-open"),
  onCustomerDisplayState: (callback) =>
    ipcRenderer.on("customer-display-state", (_e, data) => callback(data)),
});
