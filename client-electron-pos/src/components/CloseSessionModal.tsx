import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { formatCLP } from "@/utils/format";
import api from "@/services/api";
import toast from "react-hot-toast";
import { X, Printer, CheckCircle, TrendingUp, AlertTriangle } from "lucide-react";

interface Props {
  onClose: () => void;
}

function PaymentBar({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-800">
          {formatCLP(amount)}{" "}
          <span className="text-gray-400 text-xs">({pct}%)</span>
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function CloseSessionModal({ onClose }: Props) {
  const { session, closeSession, logout, setSession, register } = useAuthStore();
  const [closingAmount, setClosingAmount] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Refresh session data from server to get updated totals
  useEffect(() => {
    if (session?.id) {
      api.get(`/cash/sessions/${session.id}`).then(({ data }) => {
        setSession(data);
      });
    }
  }, [session?.id, setSession]);

  const handleClose = async () => {
    setLoading(true);
    try {
      const data = await closeSession(parseInt(closingAmount.replace(/\./g, ""), 10) || 0);
      setResult(data);
      toast.success("Caja cerrada correctamente");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al cerrar caja");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    onClose();
  };

  const handlePrint = async () => {
    if (!result || !window.electronAPI?.printReceipt) return;
    setPrinting(true);
    try {
      const totalSales =
        (result.total_cash_sales ?? 0) +
        (result.total_card_sales ?? 0) +
        (result.total_transfer_sales ?? 0);
      const avgTicket =
        result.total_sales_count > 0 ? Math.round(totalSales / result.total_sales_count) : 0;
      const diffSign = result.difference > 0 ? "+" : "";
      const now = new Date().toLocaleString("es-CL");

      const html = `
        <div style="font-family:monospace;font-size:12px;padding:0 4px;">
          <div style="text-align:center;font-weight:700;font-size:14px;margin-bottom:4px;">RESUMEN DE TURNO</div>
          ${register?.name ? `<div style="text-align:center;font-size:11px;">${register.name}</div>` : ""}
          <div style="text-align:center;font-size:10px;color:#555;margin-bottom:8px;">${now}</div>
          <hr style="border:none;border-top:1px dashed #000;margin:6px 0;">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
            <span>Total ventas</span><span style="font-weight:700;">${formatCLP(totalSales)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
            <span>N° transacciones</span><span>${result.total_sales_count}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span>Ticket promedio</span><span>${formatCLP(avgTicket)}</span>
          </div>
          <hr style="border:none;border-top:1px dashed #000;margin:6px 0;">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
            <span>Efectivo</span><span>${formatCLP(result.total_cash_sales)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
            <span>Tarjeta</span><span>${formatCLP(result.total_card_sales)}</span>
          </div>
          ${
            (result.total_transfer_sales ?? 0) > 0
              ? `<div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                   <span>Transferencia</span><span>${formatCLP(result.total_transfer_sales)}</span>
                 </div>`
              : ""
          }
          <hr style="border:none;border-top:1px dashed #000;margin:6px 0;">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
            <span>Apertura</span><span>${formatCLP(result.opening_amount)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
            <span>Efectivo esperado</span><span>${formatCLP(result.expected_cash)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span>Efectivo declarado</span><span>${formatCLP(result.closing_amount)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-weight:700;border-top:1px dashed #000;padding-top:4px;">
            <span>DIFERENCIA</span><span>${diffSign}${formatCLP(result.difference)}</span>
          </div>
        </div>`;

      const printResult = await window.electronAPI.printReceipt({
        content: [{ type: "text", value: html, style: { width: "100%", boxSizing: "border-box" } }],
      });
      if (printResult.success) {
        toast.success("Resumen impreso");
      } else {
        toast.error(printResult.error || "Error al imprimir");
      }
    } finally {
      setPrinting(false);
    }
  };

  if (result) {
    const totalSales =
      (result.total_cash_sales ?? 0) +
      (result.total_card_sales ?? 0) +
      (result.total_transfer_sales ?? 0);
    const avgTicket =
      result.total_sales_count > 0 ? Math.round(totalSales / result.total_sales_count) : 0;
    const diffLabel =
      result.difference === 0 ? "Sin diferencia" : result.difference > 0 ? "Sobrante" : "Faltante";
    const DiffIcon =
      result.difference === 0 ? CheckCircle : result.difference > 0 ? TrendingUp : AlertTriangle;
    const diffClass =
      result.difference === 0
        ? "bg-green-50 text-green-700 border-green-200"
        : result.difference > 0
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : "bg-red-50 text-red-700 border-red-200";

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[480px] p-6 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle size={20} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Resumen de Turno</h2>
              <p className="text-xs text-gray-500">{new Date().toLocaleString("es-CL")}</p>
            </div>
          </div>

          {/* Summary grid */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Total ventas</p>
              <p className="text-xl font-black text-gray-900">{formatCLP(totalSales)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Transacciones</p>
              <p className="text-xl font-black text-gray-900">{result.total_sales_count}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Ticket promedio</p>
              <p className="text-lg font-bold text-blue-700">{formatCLP(avgTicket)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Apertura caja</p>
              <p className="text-lg font-bold text-gray-700">{formatCLP(result.opening_amount)}</p>
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Desglose por método de pago
            </p>
            <div className="space-y-3">
              <PaymentBar
                label="Efectivo"
                amount={result.total_cash_sales ?? 0}
                total={totalSales}
                color="bg-green-500"
              />
              <PaymentBar
                label="Tarjeta"
                amount={result.total_card_sales ?? 0}
                total={totalSales}
                color="bg-blue-500"
              />
              {(result.total_transfer_sales ?? 0) > 0 && (
                <PaymentBar
                  label="Transferencia"
                  amount={result.total_transfer_sales}
                  total={totalSales}
                  color="bg-purple-500"
                />
              )}
            </div>
          </div>

          {/* Cash reconciliation */}
          <div className="border border-gray-100 rounded-xl p-4 mb-4 space-y-2 text-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Reconciliación de caja
            </p>
            <div className="flex justify-between">
              <span className="text-gray-600">Efectivo esperado</span>
              <span className="font-semibold">{formatCLP(result.expected_cash)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Efectivo declarado</span>
              <span className="font-semibold">{formatCLP(result.closing_amount)}</span>
            </div>
          </div>

          {/* Difference card */}
          <div className={`flex items-center justify-between p-4 rounded-xl border mb-5 ${diffClass}`}>
            <div className="flex items-center gap-2">
              <DiffIcon size={18} />
              <span className="font-semibold">{diffLabel}</span>
            </div>
            <span className="text-2xl font-black">
              {result.difference > 0 ? "+" : ""}
              {formatCLP(result.difference)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {!!window.electronAPI?.printReceipt && (
              <button
                onClick={handlePrint}
                disabled={printing}
                className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-semibold transition disabled:opacity-50"
              >
                <Printer size={16} />
                {printing ? "Imprimiendo..." : "Imprimir"}
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-[450px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">Cierre de Caja</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {session && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
            <p>Ventas efectivo: <strong>{formatCLP(session.total_cash_sales)}</strong></p>
            <p>Ventas tarjeta: <strong>{formatCLP(session.total_card_sales)}</strong></p>
            {(session.total_transfer_sales ?? 0) > 0 && (
              <p>Ventas transferencia: <strong>{formatCLP(session.total_transfer_sales)}</strong></p>
            )}
            <p>Cant. ventas: <strong>{session.total_sales_count}</strong></p>
          </div>
        )}

        <label className="block text-sm font-medium text-gray-700 mb-1">Efectivo contado en caja</label>
        <input
          type="text"
          inputMode="numeric"
          value={closingAmount}
          onChange={(e) => setClosingAmount(e.target.value.replace(/[^\d.]/g, ""))}
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-xl font-mono text-center focus:border-blue-500 focus:outline-none mb-4"
          placeholder="0"
          autoFocus
        />

        <button
          onClick={handleClose}
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white py-3 rounded-xl font-semibold transition"
        >
          {loading ? "Cerrando..." : "Cerrar Caja"}
        </button>
      </div>
    </div>
  );
}
