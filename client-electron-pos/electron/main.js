const { app, BrowserWindow, ipcMain, globalShortcut, dialog, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("path");
const { promisify } = require("node:util");

// Pipe electron-updater logs to file
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";

const execFileAsync = promisify(execFile);
const PRINT_JOB_MIN_TIMEOUT_MS = 15000;
const THERMAL_PAGE_WIDTH_MICRONS = 80000;
const THERMAL_CONTENT_WIDTH_PX = 260;
const THERMAL_PRINT_WINDOW_HEIGHT_PX = 1400;
const THERMAL_PRINT_HEIGHT_PADDING_PX = 24;
const THERMAL_MIN_PAGE_HEIGHT_PX = 220;
const THERMAL_PAGE_WIDTH_INCHES = 3.15;

let mainWindow;

// Persist update state so renderer can query it after mounting
let updateState = "idle"; // "idle" | "downloading" | "ready"
let updateProgress = 0;

function normalizePrinterText(value) {
  return String(value || "").trim().toLowerCase();
}

function mergePrinterLists(electronPrinters = [], windowsPrinters = []) {
  const printers = new Map();

  for (const printer of [...electronPrinters, ...windowsPrinters]) {
    const key = normalizePrinterText(printer.name || printer.displayName);
    if (!key) continue;

    const current = printers.get(key);
    printers.set(key, {
      name: printer.name || current?.name || "",
      displayName: printer.displayName || printer.name || current?.displayName || "",
      description: printer.description || current?.description || "",
      isDefault: Boolean(printer.isDefault || current?.isDefault),
      status: typeof printer.status === "number" ? printer.status : (current?.status ?? 0),
      source: current ? "merged" : (printer.source || "electron"),
    });
  }

  return Array.from(printers.values()).sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });
}

async function getWindowsPrinters() {
  if (process.platform !== "win32") return [];

  const script = [
    '$ErrorActionPreference = "Stop"',
    "Get-Printer | Select-Object Name,DriverName,PortName,Default,PrinterStatus | ConvertTo-Json -Compress",
  ].join("; ");

  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-Command", script],
      { windowsHide: true, timeout: 5000, maxBuffer: 1024 * 1024 },
    );

    if (!stdout || !stdout.trim()) return [];

    const parsed = JSON.parse(stdout);
    const list = Array.isArray(parsed) ? parsed : [parsed];

    return list.map((printer) => ({
      name: printer.Name || "",
      displayName: printer.Name || "",
      description: [printer.DriverName, printer.PortName].filter(Boolean).join(" - "),
      isDefault: Boolean(printer.Default),
      status: Number.isFinite(printer.PrinterStatus) ? printer.PrinterStatus : 0,
      source: "windows",
    }));
  } catch (err) {
    log.warn("getWindowsPrinters error:", err);
    return [];
  }
}

async function listAvailablePrinters() {
  const windowsPrinters = await getWindowsPrinters();

  try {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return windowsPrinters;
    }

    const electronPrinters = await mainWindow.webContents.getPrintersAsync();
    return mergePrinterLists(electronPrinters, windowsPrinters);
  } catch (err) {
    log.warn("getPrintersAsync error:", err);
    return windowsPrinters;
  }
}

async function getElectronPrinters() {
  if (!mainWindow || mainWindow.isDestroyed()) return [];

  try {
    return await mainWindow.webContents.getPrintersAsync();
  } catch (err) {
    log.warn("getElectronPrinters error:", err);
    return [];
  }
}

function resolvePrinterName(printers, requestedName) {
  const normalizedRequested = normalizePrinterText(requestedName);
  if (!normalizedRequested) return "";

  const exactMatch = printers.find((printer) =>
    [printer.name, printer.displayName, printer.description].some(
      (value) => normalizePrinterText(value) === normalizedRequested,
    ),
  );
  if (exactMatch) return exactMatch.name;

  const fuzzyMatch = printers.find((printer) =>
    [printer.name, printer.displayName, printer.description].some((value) => {
      const normalizedValue = normalizePrinterText(value);
      return normalizedValue
        && (normalizedValue.includes(normalizedRequested)
          || normalizedRequested.includes(normalizedValue));
    }),
  );

  return fuzzyMatch?.name || String(requestedName).trim();
}

function escapePrintHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isHtmlString(value) {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ""));
}

function toKebabCase(value) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function styleObjectToCss(style = {}) {
  return Object.entries(style)
    .filter(([, value]) => value != null && value !== "")
    .map(([key, value]) => `${toKebabCase(key)}:${String(value)};`)
    .join("");
}

function buildPrintableHtml(content) {
  const rows = Array.isArray(content) ? content : [];
  const bodyHtml = rows.map((line) => {
    if (!line || line.type !== "text") return "";

    const css = styleObjectToCss(line.style);
    const value = isHtmlString(line.value)
      ? String(line.value)
      : escapePrintHtml(line.value).replace(/\r?\n/g, "<br />");

    return `<div style="${css}">${value}</div>`;
  }).join("");

  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '<meta charset="UTF-8" />',
    "<style>",
    "@page { margin: 0; }",
    "html, body { margin: 0; padding: 0; background: #ffffff; }",
    `body { width: ${THERMAL_CONTENT_WIDTH_PX}px; overflow: visible; -webkit-print-color-adjust: exact; print-color-adjust: exact; }`,
    "#print-root {",
    `  width: ${THERMAL_CONTENT_WIDTH_PX}px;`,
    "  box-sizing: border-box;",
    "  overflow: visible;",
    "  page-break-inside: avoid;",
    "  break-inside: avoid-page;",
    "}",
    "#print-root, #print-root * { box-sizing: border-box; }",
    "</style>",
    "</head>",
    "<body>",
    `<div id="print-root">${bodyHtml}</div>`,
    "</body>",
    "</html>",
  ].join("");
}

function pxToMicrons(px) {
  return Math.ceil(px * 264.5833);
}

function pxToInches(px) {
  return Number((px / 96).toFixed(3));
}

async function measurePrintableHeightPx(printWindow) {
  const script = `(() => {
    const root = document.getElementById("print-root");
    const body = document.body;
    const doc = document.documentElement;
    return Math.ceil(Math.max(
      root ? root.scrollHeight : 0,
      root ? root.offsetHeight : 0,
      root ? root.getBoundingClientRect().height : 0,
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      doc ? doc.scrollHeight : 0,
      doc ? doc.offsetHeight : 0
    ));
  })()`;

  const measuredHeight = await printWindow.webContents.executeJavaScript(script, true);
  return Math.max(THERMAL_MIN_PAGE_HEIGHT_PX, Number(measuredHeight) + THERMAL_PRINT_HEIGHT_PADDING_PX);
}

function destroyWindow(windowToDestroy) {
  if (windowToDestroy && !windowToDestroy.isDestroyed()) {
    windowToDestroy.destroy();
  }
}

async function createPrintableWindow(content) {
  const html = buildPrintableHtml(content);
  const printWindow = new BrowserWindow({
    show: false,
    width: THERMAL_CONTENT_WIDTH_PX,
    height: THERMAL_PRINT_WINDOW_HEIGHT_PX,
    useContentSize: true,
    backgroundColor: "#ffffff",
    webPreferences: {
      sandbox: true,
    },
  });

  try {
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await printWindow.webContents.executeJavaScript(
      "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
      true,
    );

    const heightPx = await measurePrintableHeightPx(printWindow);
    return { printWindow, heightPx };
  } catch (err) {
    destroyWindow(printWindow);
    throw err;
  }
}

async function printHtmlContent({ content, printerName, copies = 1 }) {
  const { printWindow, heightPx } = await createPrintableWindow(content);

  try {
    const pageSize = {
      width: THERMAL_PAGE_WIDTH_MICRONS,
      height: pxToMicrons(heightPx),
    };

    await new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("[TimedOutError] Make sure your printer is connected"));
      }, PRINT_JOB_MIN_TIMEOUT_MS);

      printWindow.webContents.print({
        silent: true,
        printBackground: true,
        copies,
        pageSize,
        ...(printerName ? { deviceName: printerName } : {}),
      }, (success, failureReason) => {
        clearTimeout(timeout);
        if (settled) return;
        settled = true;

        if (!success) {
          reject(new Error(failureReason || "Print job failed"));
          return;
        }

        resolve();
      });
    });
  } finally {
    destroyWindow(printWindow);
  }
}

function normalizePdfFileName(value) {
  const baseName = String(value || "boleta")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .trim();

  if (!baseName) return "boleta.pdf";
  return baseName.toLowerCase().endsWith(".pdf") ? baseName : `${baseName}.pdf`;
}

async function savePdfFile({ content, defaultFileName }) {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: "Guardar boleta como PDF",
    defaultPath: path.join(app.getPath("documents"), normalizePdfFileName(defaultFileName)),
    buttonLabel: "Guardar PDF",
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });

  if (canceled || !filePath) {
    return { success: false, canceled: true };
  }

  const { printWindow, heightPx } = await createPrintableWindow(content);

  try {
    const pdfBuffer = await printWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: {
        width: THERMAL_PAGE_WIDTH_INCHES,
        height: pxToInches(heightPx),
      },
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },
    });

    await fs.writeFile(filePath, pdfBuffer);
    return { success: true, filePath, canceled: false };
  } finally {
    destroyWindow(printWindow);
  }
}

function normalizeWhatsAppPhone(phoneNumber) {
  const digits = String(phoneNumber || "").replace(/\D+/g, "");
  if (!digits) return "";
  return digits.startsWith("+" ) ? digits : digits;
}

function buildWhatsAppUrl({ text, phoneNumber }) {
  const message = String(text || "").trim();
  const normalizedPhone = normalizeWhatsAppPhone(phoneNumber);
  const baseUrl = normalizedPhone
    ? `https://wa.me/${normalizedPhone}`
    : "https://wa.me/";

  return `${baseUrl}?text=${encodeURIComponent(message)}`;
}

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
    title: `Nexo v${app.getVersion()}`,
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
    mainWindow.setTitle(`Nexo v${app.getVersion()}`);
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
ipcMain.handle("get-printers", async () => {
  return listAvailablePrinters();
});

// Printing via electron-pos-printer
ipcMain.handle("print-receipt", async (_event, data) => {
  try {
    const electronPrinters = await getElectronPrinters();
    const requestedPrinterName = String(data.printerName || "").trim();
    const resolvedPrinterName = resolvePrinterName(electronPrinters, requestedPrinterName);
    const defaultPrinterName = electronPrinters.find((printer) => printer.isDefault)?.name || "";
    const printerName = resolvedPrinterName || defaultPrinterName || "";

    if (requestedPrinterName && !resolvedPrinterName) {
      log.warn("Requested printer was not found in Electron printer list.", {
        requestedPrinterName,
        fallbackPrinterName: printerName,
        availablePrinters: electronPrinters.map((printer) => printer.name),
      });
    }

    await printHtmlContent({
      content: data.content,
      printerName,
      copies: Number(data.copies) > 0 ? Number(data.copies) : 1,
    });
    return { success: true };
  } catch (err) {
    const msg = err?.message ?? (typeof err === "string" ? err : JSON.stringify(err)) ?? "Error desconocido";
    log.error("print-receipt error:", err);
    return { success: false, error: msg };
  }
});

ipcMain.handle("save-receipt-pdf", async (_event, data) => {
  try {
    return await savePdfFile({
      content: data.content,
      defaultFileName: data.defaultFileName,
    });
  } catch (err) {
    const msg = err?.message ?? (typeof err === "string" ? err : JSON.stringify(err)) ?? "Error desconocido";
    log.error("save-receipt-pdf error:", err);
    return { success: false, canceled: false, error: msg };
  }
});

ipcMain.handle("open-whatsapp", async (_event, data) => {
  try {
    const url = buildWhatsAppUrl({
      text: data.text,
      phoneNumber: data.phoneNumber,
    });

    await shell.openExternal(url);
    return { success: true, url };
  } catch (err) {
    const msg = err?.message ?? (typeof err === "string" ? err : JSON.stringify(err)) ?? "Error desconocido";
    log.error("open-whatsapp error:", err);
    return { success: false, error: msg };
  }
});
