const { app, BrowserWindow, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

let mainWindow;

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
    title: "MiniMarket POS",
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
}

app.whenReady().then(createWindow);

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
  mainWindow?.webContents.send("update-available");
});

autoUpdater.on("update-downloaded", () => {
  mainWindow?.webContents.send("update-downloaded");
});

ipcMain.on("install-update", () => {
  autoUpdater.quitAndInstall();
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
    return { success: false, error: err.message };
  }
});
