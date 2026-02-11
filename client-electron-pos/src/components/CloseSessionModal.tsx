import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { formatCLP } from "@/utils/format";
import api from "@/services/api";
import toast from "react-hot-toast";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
}

export default function CloseSessionModal({ onClose }: Props) {
  const { session, closeSession, logout, setSession } = useAuthStore();
  const [closingAmount, setClosingAmount] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

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
      const data = await closeSession(parseInt(closingAmount) || 0);
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

  if (result) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl w-[450px] p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Resumen de Cierre</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Monto apertura</span>
              <span className="font-medium">{formatCLP(result.opening_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Ventas efectivo</span>
              <span className="font-medium">{formatCLP(result.total_cash_sales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Ventas tarjeta</span>
              <span className="font-medium">{formatCLP(result.total_card_sales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total ventas</span>
              <span className="font-medium">{result.total_sales_count}</span>
            </div>
            <hr />
            <div className="flex justify-between">
              <span className="text-gray-600">Efectivo esperado</span>
              <span className="font-bold">{formatCLP(result.expected_cash)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Efectivo declarado</span>
              <span className="font-bold">{formatCLP(result.closing_amount)}</span>
            </div>
            <div className={`flex justify-between p-3 rounded-lg ${
              result.difference === 0
                ? "bg-green-50 text-green-700"
                : result.difference > 0
                ? "bg-blue-50 text-blue-700"
                : "bg-red-50 text-red-700"
            }`}>
              <span>Diferencia</span>
              <span className="font-bold">{formatCLP(result.difference)}</span>
            </div>
          </div>

          <button onClick={handleLogout} className="w-full mt-6 bg-blue-600 text-white py-3 rounded-xl font-semibold">
            Cerrar sesión
          </button>
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
            <p>Cant. ventas: <strong>{session.total_sales_count}</strong></p>
          </div>
        )}

        <label className="block text-sm font-medium text-gray-700 mb-1">Efectivo contado en caja</label>
        <input
          type="number"
          value={closingAmount}
          onChange={(e) => setClosingAmount(e.target.value)}
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-xl font-mono text-center focus:border-blue-500 focus:outline-none mb-4"
          placeholder="$0"
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
