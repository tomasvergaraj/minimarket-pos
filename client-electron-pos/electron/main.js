const { app, BrowserWindow, ipcMain, globalShortcut } = require("electron");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
const path = require("path");

// Pipe electron-updater logs to file
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";

let mainWindow;

// Persist update state so renderer can query it after mounting
let updateState = "idle"; // "idle" | "downloading" | "ready"
let updateProgress = 0;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: `MiniMarket POS v${app.getVersion()}`,
    autoHideMenuBar: true,
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
    autoUpdater.checkForUpdatesAndNotify();
  }

  // Reapply title after page load (HTML <title> would otherwise override it)
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.setTitle(`MiniMarket POS v${app.getVersion()}`);
  });

}

app.whenReady().then(() => {
  createWindow();

  // F11 → toggle fullscreen (globalShortcut evita que Chromium lo intercepte)
  globalShortcut.register("F11", () => {
    if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Auto-updater events
autoUpdater.on("update-available", () => {
  updateState = "downloading";
  mainWindow?.webContents.send("update-available");
});

autoUpdater.on("download-progress", (progress) => {
  updateProgress = Math.round(progress.percent);
  mainWindow?.webContents.send("download-progress", updateProgress);
});

autoUpdater.on("update-downloaded", () => {
  updateState = "ready";
  updateProgress = 100;
  mainWindow?.webContents.send("update-downloaded");
});

autoUpdater.on("error", (err) => {
  // Silently ignore 404s (no GitHub Release published for this version yet)
  if (err.message && (err.message.includes("404") || err.message.includes("latest.yml"))) {
    log.info("Auto-updater: release not found on GitHub, skipping update check.");
    return;
  }
  mainWindow?.webContents.send("update-error", err.message);
});

ipcMain.on("install-update", () => {
  autoUpdater.quitAndInstall();
});

// Renderer queries current update state on mount (avoids race condition)
ipcMain.handle("get-update-state", () => ({ state: updateState, progress: updateProgress }));

// Fullscreen toggle via IPC
ipcMain.handle("set-fullscreen", (_event, value) => {
  mainWindow.setFullScreen(value);
});

ipcMain.handle("is-fullscreen", () => {
  return mainWindow.isFullScreen();
});

// List available printers
ipcMain.handle("get-printers", () => {
  return mainWindow.webContents.getPrinters();
});

// Printing via electron-pos-printer
ipcMain.handle("print-receipt", async (_event, data) => {
  try {
    const { PosPrinter } = require("electron-pos-printer");
    await PosPrinter.print(data.content, {
      preview: false,
      width: "302px",
      margin: "0 0 0 0",
      copies: 1,
      printerName: data.printerName || "",
      silent: true,
    });
    return { success: true };
  } catch (err) {
    const msg = err?.message ?? (typeof err === "string" ? err : JSON.stringify(err)) ?? "Error desconocido";
    log.error("print-receipt error:", err);
    return { success: false, error: msg };
  }
});
