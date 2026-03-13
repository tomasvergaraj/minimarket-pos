import { useCallback, useEffect } from "react";
import type { Order } from "@/types";
import { Printer, Settings, X } from "lucide-react";
import toast from "react-hot-toast";
import { buildOrderContent, buildOrderHtml } from "@/services/printer";
import { getSavedPrinterName } from "@/pages/SettingsPage";
import { useNavigate } from "react-router-dom";

interface Props {
  onClose: () => void;
  order: Order;
  registerName?: string;
}

export default function OrderPreviewModal({ onClose, order, registerName }: Props) {
  const navigate = useNavigate();
  const printerName = getSavedPrinterName();
  const canPrint = !!window.electronAPI && !!printerName;

  const orderHtml = buildOrderHtml(order, {
    registerName,
  });

  const handlePrint = useCallback(async () => {
    if (!window.electronAPI) {
      toast.error("Impresión solo disponible en app de escritorio");
      return;
    }
    if (!printerName) {
      toast.error("Configura una impresora en Configuración antes de imprimir");
      return;
    }

    const content = buildOrderContent(order, {
      registerName,
    });
    const result = await window.electronAPI.printReceipt({ content, printerName });

    if (result.success) {
      toast.success("Comanda impresa");
      onClose();
    } else {
      toast.error(`Error al imprimir: ${result.error}`);
    }
  }, [onClose, order, printerName, registerName]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
      if (event.key === "Enter" && !event.repeat) {
        event.stopPropagation();
        void handlePrint();
      }
    };

    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [handlePrint, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="flex flex-col items-center gap-5 max-h-screen py-6 overflow-y-auto">
        <div className="bg-white w-[22rem] shadow-2xl">
          <div className="h-2 bg-gray-100" />
          <div
            className="px-4 py-4"
            dangerouslySetInnerHTML={{ __html: orderHtml }}
          />
          <div className="h-4 bg-gradient-to-b from-gray-50 to-transparent" />
        </div>

        <div className="flex flex-col items-center gap-3">
          {window.electronAPI && !printerName && (
            <div className="flex items-center gap-2 text-yellow-300 text-sm bg-yellow-900/40 border border-yellow-600/40 px-4 py-2 rounded-lg">
              <Printer size={14} />
              Sin impresora configurada -
              <button
                onClick={() => { onClose(); navigate("/settings"); }}
                className="underline font-medium hover:text-yellow-100 flex items-center gap-1"
              >
                <Settings size={12} /> Configurar
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/30 px-6 py-3 rounded-xl font-medium transition"
            >
              <X size={16} />
              Cerrar
              <span className="text-white/50 text-xs ml-1">(Esc)</span>
            </button>
            <button
              onClick={() => void handlePrint()}
              disabled={!canPrint}
              title={!canPrint ? "Configura una impresora en Ajustes" : undefined}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-60 text-white px-8 py-3 rounded-xl font-bold transition shadow-lg"
            >
              <Printer size={18} />
              Imprimir
              {canPrint && <span className="text-blue-200 text-xs ml-1">(Enter)</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
