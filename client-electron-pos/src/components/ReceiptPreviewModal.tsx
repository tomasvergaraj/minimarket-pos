import { useEffect, useCallback, useState } from "react";
import type { Sale } from "@/types";
import { formatCLP, formatDate } from "@/utils/format";
import { Printer, X, Settings } from "lucide-react";
import toast from "react-hot-toast";
import { buildReceiptContent } from "@/services/printer";
import { getSavedPrinterName } from "@/pages/SettingsPage";
import { useNavigate } from "react-router-dom";
import PDF417Barcode from "@/components/PDF417Barcode";

interface Props {
  sale: Sale;
  onClose: () => void;
  sellerName?: string;
  registerName?: string;
}

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  mixed: "Mixto",
};

export default function ReceiptPreviewModal({ sale, onClose, sellerName, registerName }: Props) {
  const navigate = useNavigate();
  const printerName = getSavedPrinterName();
  const canPrint = !!window.electronAPI && !!printerName;
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string | undefined>(undefined);

  const handlePrint = useCallback(async () => {
    if (!window.electronAPI) {
      toast.error("Impresión solo disponible en app de escritorio");
      return;
    }
    if (!printerName) {
      toast.error("Configura una impresora en Configuración antes de imprimir");
      return;
    }
    const content = buildReceiptContent(sale, barcodeDataUrl);
    const result = await window.electronAPI.printReceipt({ content, printerName });
    if (result.success) {
      toast.success("Ticket impreso");
      onClose();
    } else {
      toast.error(`Error al imprimir: ${result.error}`);
    }
  }, [sale, onClose, printerName, barcodeDataUrl]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Enter" && !e.repeat) {
        e.stopPropagation();
        handlePrint();
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [handlePrint, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex flex-col items-center gap-5 max-h-screen py-6 overflow-y-auto">

        {/* Receipt paper */}
        <div
          className="bg-white w-80 shadow-2xl"
          style={{ fontFamily: "'Courier New', Courier, monospace" }}
        >
          {/* Top notch decoration */}
          <div className="h-2 bg-gray-100" />

          <div className="px-5 py-4">
            {/* Store header */}
            <div className="text-center mb-3">
              <p className="font-bold text-base tracking-wide">MINIMARKET POS</p>
              {registerName && (
                <p className="text-xs text-gray-500 mt-0.5">{registerName}</p>
              )}
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            <div className="text-center text-xs text-gray-500 space-y-0.5">
              {sale.sii_folio ? (
                <>
                  <p className="font-bold text-gray-900 text-sm tracking-wider">BOLETA ELECTRONICA</p>
                  <p className="font-bold text-gray-900 text-base">N° {sale.sii_folio}</p>
                </>
              ) : (
                <p className="font-semibold text-gray-800">BOLETA N° {sale.sale_number}</p>
              )}
              <p>{formatDate(sale.created_at)}</p>
              {sellerName && <p>Cajero: {sellerName}</p>}
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Items */}
            <div className="space-y-2 mb-3">
              {sale.items.map((item) => (
                <div key={item.id}>
                  <p className="text-xs font-medium leading-tight">{item.product_name}</p>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{item.quantity} x {formatCLP(item.unit_price)}</span>
                    <span className="font-medium text-gray-800">{formatCLP(item.subtotal)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Totals */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Neto:</span>
                <span>{formatCLP(sale.total - sale.tax_amount)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>IVA (19%):</span>
                <span>{formatCLP(sale.tax_amount)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-gray-900 pt-0.5">
                <span>TOTAL:</span>
                <span>{formatCLP(sale.total)}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Payment breakdown */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Forma de pago:</span>
                <span className="font-medium text-gray-800">
                  {PAYMENT_LABEL[sale.payment_method] ?? sale.payment_method}
                </span>
              </div>
              {sale.cash_amount > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Efectivo:</span>
                  <span>{formatCLP(sale.cash_amount)}</span>
                </div>
              )}
              {sale.card_amount > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Tarjeta:</span>
                  <span>{formatCLP(sale.card_amount)}</span>
                </div>
              )}
              {sale.change_amount > 0 && (
                <div className="flex justify-between font-semibold text-green-700">
                  <span>Vuelto:</span>
                  <span>{formatCLP(sale.change_amount)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-gray-400 my-3" />

            <p className="text-center text-xs text-gray-400 tracking-wide">
              *** GRACIAS POR SU COMPRA ***
            </p>

            {/* Pie DTE con PDF417 */}
            {sale.sii_folio && sale.sii_ted_xml && (
              <>
                <div className="border-t border-dashed border-gray-300 my-2" />
                <div className="flex flex-col items-center gap-1">
                  <PDF417Barcode
                    tedXml={sale.sii_ted_xml}
                    className="max-w-full"
                    onDataUrl={setBarcodeDataUrl}
                  />
                  <div className="text-center space-y-0.5" style={{ fontSize: "9px" }}>
                    <p className="text-gray-500">DTE Tipo 39 &nbsp;|&nbsp; Folio: {sale.sii_folio}</p>
                    <p className={
                      sale.sii_status === "SENT" ? "text-green-600 font-semibold" :
                      sale.sii_status === "PENDING" ? "text-yellow-600" :
                      "text-red-500"
                    }>
                      SII: {sale.sii_status ?? "PENDIENTE"}
                    </p>
                    <p className="text-gray-400">Verifique en sii.cl/validardoc</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Bottom torn edge */}
          <div className="h-4 bg-gradient-to-b from-gray-50 to-transparent" />
        </div>

        {/* Action buttons */}
        <div className="flex flex-col items-center gap-3">
          {window.electronAPI && !printerName && (
            <div className="flex items-center gap-2 text-yellow-300 text-sm bg-yellow-900/40 border border-yellow-600/40 px-4 py-2 rounded-lg">
              <Printer size={14} />
              Sin impresora configurada —{" "}
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
              onClick={handlePrint}
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
