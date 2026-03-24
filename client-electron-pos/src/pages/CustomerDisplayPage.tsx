import { useState, useEffect } from "react";
import { formatCLP } from "@/utils/format";

const PAID_RESET_DELAY_MS = 4000;

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  mixed: "Pago mixto",
};

export default function CustomerDisplayPage() {
  const [state, setState] = useState<CustomerDisplayState>({
    phase: "idle",
    storeName: "Nexo",
    items: [],
    total: 0,
  });

  useEffect(() => {
    window.electronAPI?.onCustomerDisplayState?.((data) => {
      setState(data);
    });
  }, []);

  // Auto-reset to idle a few seconds after payment confirmation
  useEffect(() => {
    if (state.phase !== "paid") return;
    const t = setTimeout(() => {
      setState((prev) => ({ ...prev, phase: "idle", items: [], total: 0 }));
    }, PAID_RESET_DELAY_MS);
    return () => clearTimeout(t);
  }, [state.phase]);

  /* ─── IDLE ────────────────────────────────────────────────── */
  if (state.phase === "idle") {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-700 to-blue-900 text-white select-none">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-6">
            <span className="text-5xl font-black text-white">N</span>
          </div>
          <h1 className="text-6xl font-black tracking-tight">{state.storeName}</h1>
          <p className="text-2xl text-blue-200 font-light">¡Bienvenido!</p>
        </div>
        <p className="absolute bottom-8 text-blue-300 text-sm">Pantalla del cliente</p>
      </div>
    );
  }

  /* ─── PAID ────────────────────────────────────────────────── */
  if (state.phase === "paid") {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-green-600 text-white select-none">
        <div className="text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto">
            <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-white" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <p className="text-3xl font-semibold text-green-100">Total pagado</p>
          <p className="text-7xl font-black">{formatCLP(state.total)}</p>
          {state.paymentMethod === "cash" && state.cashReceived != null && (
            <div className="space-y-1 text-green-100">
              <p className="text-xl">
                Recibido: <strong>{formatCLP(state.cashReceived)}</strong>
              </p>
              <p className="text-3xl font-bold text-white">
                Vuelto: {formatCLP(state.change ?? 0)}
              </p>
            </div>
          )}
          {state.paymentMethod && state.paymentMethod !== "cash" && (
            <p className="text-xl text-green-100">
              {PAYMENT_METHOD_LABEL[state.paymentMethod] ?? state.paymentMethod}
            </p>
          )}
          <p className="text-2xl text-green-100 mt-4">¡Gracias por su compra!</p>
        </div>
      </div>
    );
  }

  /* ─── SELLING ─────────────────────────────────────────────── */
  return (
    <div className="h-screen flex flex-col bg-gray-50 select-none">
      {/* Header */}
      <div className="bg-blue-700 text-white px-6 py-3 flex items-center justify-between shrink-0">
        <span className="font-bold text-lg">{state.storeName}</span>
        <span className="text-blue-200 text-sm">Su pedido</span>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto p-5 space-y-2">
        {state.items.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-300 text-lg">Agregando productos...</p>
          </div>
        ) : (
          state.items.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100"
            >
              <div className="flex-1 min-w-0 pr-3">
                <p className="font-semibold text-gray-800 text-base leading-tight truncate">
                  {item.name}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {formatCLP(item.unit_price)}
                  {item.quantity > 1 && (
                    <span className="ml-1 font-medium text-blue-600">× {item.quantity}</span>
                  )}
                </p>
              </div>
              <p className="font-bold text-blue-700 text-lg shrink-0">{formatCLP(item.subtotal)}</p>
            </div>
          ))
        )}
      </div>

      {/* Total bar */}
      <div className="bg-blue-700 text-white px-6 py-5 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xl font-medium text-blue-200">Total</span>
          <span className="text-5xl font-black">{formatCLP(state.total)}</span>
        </div>
      </div>
    </div>
  );
}
