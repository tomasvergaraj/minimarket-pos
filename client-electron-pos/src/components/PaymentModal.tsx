import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useCartStore } from "@/stores/cartStore";
import { formatCLP } from "@/utils/format";
import api from "@/services/api";
import toast from "react-hot-toast";
import type { Sale } from "@/types";
import { X, Banknote, CreditCard, ArrowLeftRight } from "lucide-react";

interface Props {
  total: number;
  onComplete: (sale: Sale) => void;
  onClose: () => void;
}

export default function PaymentModal({ total, onComplete, onClose }: Props) {
  const { session, register, user } = useAuthStore();
  const items = useCartStore((s) => s.items);
  const [method, setMethod] = useState<"cash" | "card" | "mixed">("cash");
  const [cashAmount, setCashAmount] = useState("");
  const [cardAmount, setCardAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const cashNum = parseInt(cashAmount) || 0;
  const cardNum = parseInt(cardAmount) || 0;

  const change = method === "cash" ? cashNum - total : method === "mixed" ? cashNum + cardNum - total : 0;

  const canPay =
    (method === "cash" && cashNum >= total) ||
    (method === "card" && true) ||
    (method === "mixed" && cashNum + cardNum >= total);

  const handlePay = async () => {
    if (!session || !register) return;
    setLoading(true);
    try {
      const { data } = await api.post("/sales/", {
        cash_session_id: session.id,
        register_id: register.id,
        seller_id: user?.id,
        payment_method: method,
        cash_amount: method === "card" ? 0 : cashNum,
        card_amount: method === "cash" ? 0 : method === "card" ? total : cardNum,
        items: items.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
        })),
      });
      onComplete(data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al procesar venta");
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [1000, 2000, 5000, 10000, 20000, 50000];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Cobrar</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Total */}
          <div className="text-center">
            <p className="text-gray-500">Total a cobrar</p>
            <p className="text-4xl font-bold text-gray-800">{formatCLP(total)}</p>
          </div>

          {/* Payment method */}
          <div className="grid grid-cols-3 gap-3">
            {([
              { key: "cash", label: "Efectivo", icon: Banknote },
              { key: "card", label: "Tarjeta", icon: CreditCard },
              { key: "mixed", label: "Mixto", icon: ArrowLeftRight },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setMethod(key)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition ${
                  method === key
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <Icon size={24} />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>

          {/* Cash input */}
          {(method === "cash" || method === "mixed") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto efectivo</label>
              <input
                type="number"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-xl font-mono text-center focus:border-blue-500 focus:outline-none"
                placeholder="$0"
                autoFocus
              />
              <div className="grid grid-cols-3 gap-2 mt-2">
                {quickAmounts.map((a) => (
                  <button
                    key={a}
                    onClick={() => setCashAmount(String(method === "cash" ? a : cashNum + a))}
                    className="bg-gray-100 hover:bg-gray-200 py-2 rounded-lg text-sm font-medium"
                  >
                    {formatCLP(a)}
                  </button>
                ))}
              </div>
              {method === "cash" && (
                <button
                  onClick={() => setCashAmount(String(total))}
                  className="w-full mt-2 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-lg text-sm font-medium"
                >
                  Monto exacto: {formatCLP(total)}
                </button>
              )}
            </div>
          )}

          {/* Card input */}
          {method === "mixed" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto tarjeta</label>
              <input
                type="number"
                value={cardAmount}
                onChange={(e) => setCardAmount(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-xl font-mono text-center focus:border-blue-500 focus:outline-none"
                placeholder="$0"
              />
              <button
                onClick={() => setCardAmount(String(total - cashNum))}
                className="w-full mt-2 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-lg text-sm font-medium"
              >
                Resto: {formatCLP(Math.max(total - cashNum, 0))}
              </button>
            </div>
          )}

          {/* Change display */}
          {method !== "card" && change > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-sm text-green-600">Vuelto</p>
              <p className="text-2xl font-bold text-green-700">{formatCLP(change)}</p>
            </div>
          )}

          {/* Pay button */}
          <button
            onClick={handlePay}
            disabled={!canPay || loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-4 rounded-xl font-bold text-lg transition"
          >
            {loading ? "Procesando..." : "Confirmar Pago"}
          </button>
        </div>
      </div>
    </div>
  );
}
