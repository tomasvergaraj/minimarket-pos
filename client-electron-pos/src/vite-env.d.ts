/// <reference types="vite/client" />

interface PrinterInfo {
  name: string;
  displayName: string;
  isDefault: boolean;
}

interface ElectronAPI {
  getPrinters: () => Promise<PrinterInfo[]>;
  printReceipt: (data: { content: any[]; printerName?: string }) => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => void;
  onUpdateAvailable: (callback: () => void) => void;
  onDownloadProgress: (callback: (percent: number) => void) => void;
  onUpdateDownloaded: (callback: () => void) => void;
  onUpdateError: (callback: (msg: string) => void) => void;
  setFullscreen?: (value: boolean) => Promise<void>;
  isFullscreen?: () => Promise<boolean>;
}

interface Window {
  electronAPI?: ElectronAPI;
}
