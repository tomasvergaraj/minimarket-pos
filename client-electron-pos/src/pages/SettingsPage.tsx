import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getServerUrl, setServerUrl } from "@/services/api";
import toast from "react-hot-toast";
import { ArrowLeft, Printer, RefreshCw, Maximize, Minimize } from "lucide-react";

const PRINTER_KEY = "printer_name";

export function getSavedPrinterName(): string {
  return localStorage.getItem(PRINTER_KEY) ?? "";
}

export default function SettingsPage() {
  const [url, setUrl] = useState(getServerUrl());
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState(getSavedPrinterName());
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    window.electronAPI?.isFullscreen?.().then((v) => setIsFullscreen(!!v));
  }, []);

  const toggleFullscreen = async () => {
    const next = !isFullscreen;
    await window.electronAPI?.setFullscreen?.(next);
    setIsFullscreen(next);
  };

  const loadPrinters = async () => {
    if (!window.electronAPI?.getPrinters) return;
    setLoadingPrinters(true);
    try {
      const list = await window.electronAPI.getPrinters();
      setPrinters(list);
      // Auto-select default if nothing saved
      if (!selectedPrinter) {
        const def = list.find((p: PrinterInfo) => p.isDefault);
        if (def) setSelectedPrinter(def.name);
      }
    } catch {
      toast.error("No se pudo obtener la lista de impresoras");
    } finally {
      setLoadingPrinters(false);
    }
  };

  useEffect(() => {
    loadPrinters();
  }, []);

  const handleSave = () => {
    setServerUrl(url);
    localStorage.setItem(PRINTER_KEY, selectedPrinter);
    toast.success("Configuración guardada");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate("/pos")} className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6">
          <ArrowLeft size={20} /> Volver al POS
        </button>

        <div className="bg-white rounded-xl shadow p-6 space-y-6">
          <h2 className="text-xl font-bold text-gray-800">Configuración</h2>

          {/* Server URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL del Servidor</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full border rounded-lg px-4 py-2"
              placeholder="http://192.168.1.100:8000"
            />
            <p className="text-xs text-gray-500 mt-1">IP del PC servidor en la red local</p>
          </div>

          {/* Printer selection */}
          {window.electronAPI?.getPrinters && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  <Printer size={14} className="inline mr-1" />
                  Impresora térmica
                </label>
                <button
                  onClick={loadPrinters}
                  disabled={loadingPrinters}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <RefreshCw size={12} className={loadingPrinters ? "animate-spin" : ""} />
                  Actualizar
                </button>
              </div>

              {printers.length === 0 && !loadingPrinters ? (
                <p className="text-sm text-gray-400 border rounded-lg px-4 py-2">
                  No se encontraron impresoras
                </p>
              ) : (
                <select
                  value={selectedPrinter}
                  onChange={(e) => setSelectedPrinter(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2 text-sm"
                  disabled={loadingPrinters}
                >
                  <option value="">— Sin impresora (desactivado) —</option>
                  {printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.displayName || p.name}
                      {p.isDefault ? " (predeterminada)" : ""}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Selecciona la impresora térmica ESC/POS conectada
              </p>
            </div>
          )}

          {/* Pantalla completa */}
          {window.electronAPI?.setFullscreen && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Pantalla completa</p>
                <p className="text-xs text-gray-500">También puedes usar F11</p>
              </div>
              <button
                onClick={toggleFullscreen}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                {isFullscreen ? "Salir" : "Activar"}
              </button>
            </div>
          )}

          <button onClick={handleSave} className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium">
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
