/// <reference types="vite/client" />

interface ElectronAPI {
  printReceipt: (data: { content: any[]; printerName?: string }) => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => void;
  onUpdateAvailable: (callback: () => void) => void;
  onUpdateDownloaded: (callback: () => void) => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}
