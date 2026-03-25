const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getPrinters: () => ipcRenderer.invoke("get-printers"),
  printReceipt: (data) => ipcRenderer.invoke("print-receipt", data),
  saveReceiptPdf: (data) => ipcRenderer.invoke("save-receipt-pdf", data),
  openWhatsApp: (data) => ipcRenderer.invoke("open-whatsapp", data),
  whatsappShareReceipt: (data) => ipcRenderer.invoke("whatsapp-share-receipt", data),
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
  // Kitchen Display System (KDS)
  openKitchenDisplay: () => ipcRenderer.invoke("open-kitchen-display"),
  closeKitchenDisplay: () => ipcRenderer.invoke("close-kitchen-display"),
  isKitchenDisplayOpen: () => ipcRenderer.invoke("is-kitchen-display-open"),
  // Transbank POS (PINpad)
  transbankListPorts: () => ipcRenderer.invoke("transbank-list-ports"),
  transbankConnect: (port) => ipcRenderer.invoke("transbank-connect", port),
  transbankDisconnect: () => ipcRenderer.invoke("transbank-disconnect"),
  transbankGetStatus: () => ipcRenderer.invoke("transbank-get-status"),
  transbankSale: (data) => ipcRenderer.invoke("transbank-sale", data),
  transbankCloseDay: () => ipcRenderer.invoke("transbank-close-day"),
});
