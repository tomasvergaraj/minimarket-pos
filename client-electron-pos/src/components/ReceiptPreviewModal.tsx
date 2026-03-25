import { useCallback, useEffect, useState } from "react";
import type { Sale } from "@/types";
import { Download, Mail, MessageCircle, Printer, Settings, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  buildReceiptContent,
  buildReceiptHtml,
  buildReceiptPdfFileName,
} from "@/services/printer";
import { getSavedPrinterName } from "@/pages/SettingsPage";
import { useNavigate } from "react-router-dom";
import api from "@/services/api";

interface Props {
  sale: Sale;
  onClose: () => void;
  sellerName?: string;
  registerName?: string;
}

export default function ReceiptPreviewModal({ sale, onClose, sellerName, registerName }: Props) {
  const navigate = useNavigate();
  const printerName = getSavedPrinterName();
  const [savingPdf, setSavingPdf] = useState(false);
  const [openingWhatsApp, setOpeningWhatsApp] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const hasDesktopApi = !!window.electronAPI;
  const canPrint = !!window.electronAPI && !!printerName;

  const receiptHtml = buildReceiptHtml(sale, {
    registerName,
    sellerName,
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

    const content = buildReceiptContent(sale, {
      registerName,
      sellerName,
    });
    const result = await window.electronAPI.printReceipt({ content, printerName });

    if (result.success) {
      toast.success("Ticket impreso");
      onClose();
    } else {
      toast.error(`Error al imprimir: ${result.error}`);
    }
  }, [onClose, printerName, registerName, sale, sellerName]);

  const handleSavePdf = useCallback(async () => {
    if (!window.electronAPI) {
      toast.error("PDF solo disponible en app de escritorio");
      return;
    }

    setSavingPdf(true);
    try {
      const content = buildReceiptContent(sale, {
        registerName,
        sellerName,
      });
      const result = await window.electronAPI.saveReceiptPdf({
        content,
        defaultFileName: buildReceiptPdfFileName(sale),
      });

      if (result.success) {
        toast.success("Boleta guardada como PDF");
      } else if (!result.canceled) {
        toast.error(`Error guardando PDF: ${result.error}`);
      }
    } finally {
      setSavingPdf(false);
    }
  }, [registerName, sale, sellerName]);

  const handleOpenWhatsApp = useCallback(async () => {
    if (!window.electronAPI) {
      toast.error("WhatsApp solo disponible en app de escritorio");
      return;
    }

    setOpeningWhatsApp(true);
    try {
      const content = buildReceiptContent(sale, { registerName, sellerName });
      const result = await window.electronAPI.whatsappShareReceipt({ content });

      if (result.success) {
        toast.success("Boleta copiada al portapapeles — pégala en WhatsApp con Ctrl+V", { duration: 5000 });
      } else {
        toast.error(`Error: ${result.error}`);
      }
    } finally {
      setOpeningWhatsApp(false);
    }
  }, [registerName, sale, sellerName]);

  const handleSendEmail = useCallback(async () => {
    if (!emailInput.trim()) return;
    setSendingEmail(true);
    try {
      await api.post(`/sales/${sale.id}/send-receipt`, { email: emailInput.trim() });
      toast.success(`Recibo enviado a ${emailInput.trim()}`);
      setEmailInput("");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al enviar el recibo");
    } finally {
      setSendingEmail(false);
    }
  }, [emailInput, sale.id]);

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
        <div className="bg-white w-[18rem] shadow-2xl">
          <div className="h-2 bg-gray-100" />
          <div
            className="px-4 py-4"
            dangerouslySetInnerHTML={{ __html: receiptHtml }}
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

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => void handleSavePdf()}
              disabled={!hasDesktopApi || savingPdf}
              className="inline-flex items-center gap-1.5 text-white/70 hover:text-white disabled:opacity-40 transition"
            >
              <Download size={14} />
              {savingPdf ? "Guardando..." : "PDF"}
            </button>
            <span className="h-3 w-px bg-white/20" />
            <button
              onClick={() => void handleOpenWhatsApp()}
              disabled={!hasDesktopApi || openingWhatsApp}
              className="inline-flex items-center gap-1.5 text-white/70 hover:text-white disabled:opacity-40 transition"
            >
              <MessageCircle size={14} />
              {openingWhatsApp ? "Abriendo..." : "WhatsApp"}
            </button>
          </div>

          <div className="flex items-center gap-2 w-full max-w-xs">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); void handleSendEmail(); } }}
              placeholder="correo@ejemplo.com"
              className="flex-1 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs placeholder:text-white/40 focus:outline-none focus:border-white/50"
            />
            <button
              onClick={() => void handleSendEmail()}
              disabled={!emailInput.trim() || sendingEmail}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-medium transition"
            >
              <Mail size={13} />
              {sendingEmail ? "Enviando..." : "Email"}
            </button>
          </div>

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
