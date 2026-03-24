/// <reference types="vite/client" />

interface PrinterInfo {
  name: string;
  displayName: string;
  description?: string;
  isDefault: boolean;
  status?: number;
  source?: "electron" | "windows" | "merged";
}

interface ElectronAPI {
  getPrinters: () => Promise<PrinterInfo[]>;
  printReceipt: (data: { content: any[]; printerName?: string }) => Promise<{ success: boolean; error?: string }>;
  saveReceiptPdf: (data: { content: any[]; defaultFileName?: string }) => Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }>;
  openWhatsApp: (data: { text: string; phoneNumber?: string }) => Promise<{ success: boolean; url?: string; error?: string }>;
  installUpdate: () => void;
  getUpdateState: () => Promise<{ state: "idle" | "downloading" | "ready"; progress: number }>;
  onUpdateAvailable: (callback: () => void) => void;
  onDownloadProgress: (callback: (percent: number) => void) => void;
  onUpdateDownloaded: (callback: () => void) => void;
  onUpdateError: (callback: (msg: string) => void) => void;
  setFullscreen?: (value: boolean) => Promise<void>;
  isFullscreen?: () => Promise<boolean>;
  // Customer display
  updateCustomerDisplay?: (data: CustomerDisplayState) => void;
  openCustomerDisplay?: () => Promise<void>;
  closeCustomerDisplay?: () => Promise<void>;
  isCustomerDisplayOpen?: () => Promise<boolean>;
  onCustomerDisplayState?: (callback: (data: CustomerDisplayState) => void) => void;
}

interface CustomerDisplayItem {
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface CustomerDisplayState {
  phase: "idle" | "selling" | "paid";
  storeName: string;
  items: CustomerDisplayItem[];
  total: number;
  cashReceived?: number;
  change?: number;
  paymentMethod?: string;
}

interface Window {
  electronAPI?: ElectronAPI;
}
