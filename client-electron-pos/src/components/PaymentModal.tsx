import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useCartStore } from "@/stores/cartStore";
import { formatCLP } from "@/utils/format";
import api from "@/services/api";
import toast from "react-hot-toast";
import type { Sale } from "@/types";
import { ArrowLeftRight, Banknote, CreditCard, Landmark, Receipt, X } from "lucide-react";

const BOLETA_KEY = "pos_generar_boleta";

function loadBoletaPref(): boolean {
  try {
    const v = localStorage.getItem(BOLETA_KEY);
    return v === null ? true : v === "true";
  } catch {
    return true;
  }
}

interface Props {
  total: number;
  onComplete: (sale: Sale, showReceipt: boolean) => void;
  onClose: () => void;
  /** IDs of open orders (comandas) to link/close with this sale */
  orderIds?: string[];
  /** Loyalty */
  customerId?: string | null;
  pointsToRedeem?: number;
  loyaltyDiscount?: number;
}

export default function PaymentModal({ total, onComplete, onClose, orderIds, customerId, pointsToRedeem = 0, loyaltyDiscount = 0 }: Props) {
  const { session, register } = useAuthStore();
  const items = useCartStore((s) => s.items);
  const [method, setMethod] = useState<"cash" | "card" | "mixed" | "transfer">("card");
  const [cashAmount, setCashAmount] = useState("");
  const [cardAmount, setCardAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [generarBoleta, setGenerarBoleta] = useState(loadBoletaPref);

  // Transbank PINpad
  const [pinpadAvailable, setPinpadAvailable] = useState(false);
  const [transbankStatus, setTransbankStatus] = useState<"idle" | "waiting" | "approved" | "failed">("idle");
  const [cardAuthCode, setCardAuthCode] = useState<string | null>(null);
  const [cardLast4, setCardLast4] = useState<string | null>(null);

  useEffect(() => {
    window.electronAPI?.transbankGetStatus?.().then((s) => {
      if (s) setPinpadAvailable(s.connected);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setTransbankStatus("idle");
    setCardAuthCode(null);
    setCardLast4(null);
  }, [method]);

  const cashNum = parseInt(cashAmount) || 0;
  const cardNum = parseInt(cardAmount) || 0;
  const transferNum = parseInt(transferAmount) || 0;

  const mixedTotal = cashNum + cardNum + transferNum;
  const change =
    method === "cash" ? cashNum - total :
    method === "mixed" ? mixedTotal - total : 0;

  const canPay =
    (method === "cash" && cashNum >= total) ||
    (method === "card" && (!pinpadAvailable || transbankStatus === "approved")) ||
    (method === "transfer") ||
    (method === "mixed" && mixedTotal >= total);

  const handleTransbankSale = async () => {
    setTransbankStatus("waiting");
    try {
      const ticket = String(Date.now()).slice(-6);
      const res = await window.electronAPI!.transbankSale!({ amount: total, ticket });
      if (res.success) {
        setCardAuthCode(res.authCode ?? null);
        setCardLast4(res.last4 ?? null);
        setTransbankStatus("approved");
        toast.success("Pago aprobado por PINpad");
      } else {
        setTransbankStatus("failed");
        toast.error(res.error ?? "Pago rechazado por el PINpad");
      }
    } catch {
      setTransbankStatus("failed");
      toast.error("Error al comunicarse con el PINpad");
    }
  };

  const handleGenerarBoletaToggle = () => {
    const next = !generarBoleta;
    setGenerarBoleta(next);
    try { localStorage.setItem(BOLETA_KEY, String(next)); } catch {}
  };

  const handlePay = async () => {
    if (!session || !register) return;
    setLoading(true);
    try {
      const { data } = await api.post("/sales/", {
        cash_session_id: session.id,
        register_id: register.id,
        payment_method: method,
        cash_amount: method === "card" || method === "transfer" ? 0 : cashNum,
        card_amount: method === "cash" || method === "transfer" ? 0 : method === "card" ? total : cardNum,
        transfer_amount: method === "transfer" ? total : method === "mixed" ? transferNum : 0,
        items: items.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
          unit_price_override: i.unit_price,
        })),
        ...(orderIds && orderIds.length > 0 ? { order_ids: orderIds } : {}),
        ...(customerId ? { customer_id: customerId, points_to_redeem: pointsToRedeem } : {}),
        ...(cardAuthCode ? { card_auth_code: cardAuthCode } : {}),
        ...(cardLast4 ? { card_last4: cardLast4 } : {}),
      });
      onComplete(data, generarBoleta);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al procesar venta");
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [1000, 2000, 5000, 10000, 20000, 50000];

  const paymentMethods = [
    { key: "card" as const, label: "Tarjeta", icon: CreditCard },
    { key: "cash" as const, label: "Efectivo", icon: Banknote },
    { key: "transfer" as const, label: "Transferencia", icon: Landmark },
    { key: "mixed" as const, label: "Mixto", icon: ArrowLeftRight },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-[540px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Cobrar</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Total */}
          <div className="text-center">
            {loyaltyDiscount > 0 && (
              <div className="text-sm text-emerald-600 font-medium mb-1">
                Descuento puntos: −{formatCLP(loyaltyDiscount)}
              </div>
            )}
            <p className="text-gray-500">Total a cobrar</p>
            <p className="text-4xl font-bold text-gray-800">{formatCLP(total)}</p>
          </div>

          {/* Payment method */}
          <div className="grid grid-cols-4 gap-2">
            {paymentMethods.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setMethod(key)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition ${
                  method === key
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <Icon size={22} />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>

          {/* Transbank PINpad (card method + PINpad connected) */}
          {method === "card" && pinpadAvailable && (
            <div className={`rounded-xl border p-4 ${
              transbankStatus === "approved" ? "border-emerald-200 bg-emerald-50" :
              transbankStatus === "waiting" ? "border-blue-200 bg-blue-50" :
              transbankStatus === "failed" ? "border-red-200 bg-red-50" :
              "border-gray-200 bg-gray-50"
            }`}>
              {transbankStatus === "idle" && (
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-3">Cobrar con PINpad Transbank</p>
                  <button
                    onClick={() => void handleTransbankSale()}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700"
                  >
                    Cobrar {formatCLP(total)} con PINpad
                  </button>
                </div>
              )}
              {transbankStatus === "waiting" && (
                <div className="text-center py-2">
                  <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                  <p className="text-sm font-medium text-blue-700">Esperando respuesta del PINpad...</p>
                  <p className="text-xs text-blue-500 mt-1">Pide al cliente que inserte o acerque su tarjeta</p>
                </div>
              )}
              {transbankStatus === "approved" && (
                <div className="text-center">
                  <p className="font-semibold text-emerald-700">Pago aprobado ✓</p>
                  <p className="text-sm text-emerald-600 mt-1">
                    Auth: {cardAuthCode}
                    {cardLast4 && <span> · **** {cardLast4}</span>}
                  </p>
                  <button
                    onClick={() => { setTransbankStatus("idle"); setCardAuthCode(null); setCardLast4(null); }}
                    className="mt-2 text-xs text-gray-500 underline"
                  >
                    Volver a cobrar
                  </button>
                </div>
              )}
              {transbankStatus === "failed" && (
                <div className="text-center">
                  <p className="font-semibold text-red-600">Pago rechazado</p>
                  <button
                    onClick={() => setTransbankStatus("idle")}
                    className="mt-2 w-full rounded-xl border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Reintentar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Card info (no PINpad) */}
          {method === "card" && !pinpadAvailable && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex items-center gap-2 text-gray-700 mb-1">
                <CreditCard size={16} />
                <span className="font-semibold text-sm">Pago con tarjeta</span>
              </div>
              <p className="text-xs text-gray-500">Total a cobrar: <strong>{formatCLP(total)}</strong></p>
              <p className="text-xs text-gray-400 mt-1">Confirma el pago antes de completar la venta.</p>
            </div>
          )}

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

          {/* Card input (mixed only) */}
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
                onClick={() => setCardAmount(String(Math.max(total - cashNum - transferNum, 0)))}
                className="w-full mt-2 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-lg text-sm font-medium"
              >
                Resto: {formatCLP(Math.max(total - cashNum - transferNum, 0))}
              </button>
            </div>
          )}

          {/* Transfer input (mixed only) */}
          {method === "mixed" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto transferencia</label>
              <input
                type="number"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-xl font-mono text-center focus:border-blue-500 focus:outline-none"
                placeholder="$0"
              />
              <button
                onClick={() => setTransferAmount(String(Math.max(total - cashNum - cardNum, 0)))}
                className="w-full mt-2 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-lg text-sm font-medium"
              >
                Resto: {formatCLP(Math.max(total - cashNum - cardNum, 0))}
              </button>
            </div>
          )}

          {/* Mixed total progress */}
          {method === "mixed" && mixedTotal > 0 && (
            <div className={`rounded-xl px-4 py-3 text-center text-sm font-medium ${
              mixedTotal >= total ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"
            }`}>
              Suma: {formatCLP(mixedTotal)} / {formatCLP(total)}
              {mixedTotal < total && <span className="ml-2 text-xs">Falta {formatCLP(total - mixedTotal)}</span>}
            </div>
          )}

          {/* Transfer info (pure transfer mode) */}
          {method === "transfer" && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-blue-700 mb-1">
                <Landmark size={16} />
                <span className="font-semibold text-sm">Transferencia bancaria</span>
              </div>
              <p className="text-xs text-blue-600">Total a transferir: <strong>{formatCLP(total)}</strong></p>
              <p className="text-xs text-blue-500 mt-1">Confirma la transferencia antes de completar la venta.</p>
            </div>
          )}

          {/* Change display */}
          {(method === "cash" || method === "mixed") && change > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-sm text-green-600">Vuelto</p>
              <p className="text-2xl font-bold text-green-700">{formatCLP(change)}</p>
            </div>
          )}

          {/* Boleta toggle */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Receipt size={16} className={generarBoleta ? "text-blue-600" : "text-gray-400"} />
              <span>Generar boleta</span>
            </div>
            <button
              type="button"
              onClick={handleGenerarBoletaToggle}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                generarBoleta ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  generarBoleta ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

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
