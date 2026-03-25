import { useEffect, useState, useCallback } from "react";
import { Clock, ChefHat, CheckCircle } from "lucide-react";
import api from "@/services/api";
import type { Order } from "@/types";

const POLL_INTERVAL_MS = 8_000;

function timeElapsed(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min ${diff % 60}s`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}min`;
}

function urgencyClass(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins >= 20) return "border-red-500 bg-red-950";
  if (mins >= 10) return "border-yellow-500 bg-yellow-950";
  return "border-green-500 bg-gray-800";
}

export default function KitchenDisplayPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<Order[]>("/orders/", {
        params: { status: "open", limit: 30 },
      });
      // Sort: bill_requested first, then oldest first
      const sorted = [...data].sort((a, b) => {
        if (a.bill_requested && !b.bill_requested) return -1;
        if (!a.bill_requested && b.bill_requested) return 1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      setOrders(sorted);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    load();
    const pollId = setInterval(load, POLL_INTERVAL_MS);
    const clockId = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(pollId); clearInterval(clockId); };
  }, [load]);

  const handleDone = async (orderId: string) => {
    try {
      await api.post(`/orders/${orderId}/cancel`);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch {
      // silent
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <ChefHat className="w-6 h-6 text-orange-400" />
          <span className="text-xl font-bold tracking-tight">Nexo KDS — Cocina</span>
        </div>
        <div className="flex items-center gap-2 text-gray-300 text-sm">
          <Clock className="w-4 h-4" />
          <span>{new Date(now).toLocaleTimeString("es-CL")}</span>
          <span className="ml-4 bg-gray-700 px-2 py-0.5 rounded text-xs">
            {orders.length} {orders.length === 1 ? "comanda" : "comandas"} activas
          </span>
        </div>
      </div>

      {/* Orders grid */}
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[80vh] gap-4 text-gray-500">
          <ChefHat className="w-16 h-16 opacity-30" />
          <p className="text-xl font-semibold">Sin comandas pendientes</p>
          <p className="text-sm">Las nuevas comandas aparecerán aquí automáticamente</p>
        </div>
      ) : (
        <div className="p-5 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {orders.map((order) => (
            <div
              key={order.id}
              className={`border-2 rounded-xl overflow-hidden transition-colors ${urgencyClass(order.created_at)}`}
            >
              {/* Card header */}
              <div className="flex items-center justify-between px-4 py-3 bg-black/20">
                <div>
                  <span className="text-lg font-black text-white">#{order.order_number}</span>
                  {order.reference && (
                    <span className="ml-2 text-sm font-semibold text-gray-300">{order.reference}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {order.bill_requested && (
                    <span className="text-[10px] font-bold uppercase bg-yellow-500 text-black px-2 py-0.5 rounded-full animate-pulse">
                      Cuenta pedida
                    </span>
                  )}
                  <div className="flex items-center gap-1 text-sm text-gray-300">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{timeElapsed(order.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="px-4 py-3 space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <span className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-lg text-lg font-black text-white shrink-0">
                      {item.quantity}
                    </span>
                    <span className="text-[15px] font-semibold text-white leading-tight">{item.product_name}</span>
                  </div>
                ))}
              </div>

              {/* Notes */}
              {order.notes && (
                <div className="px-4 pb-3">
                  <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg px-3 py-2 text-[12px] text-yellow-200">
                    📝 {order.notes}
                  </div>
                </div>
              )}

              {/* Done button */}
              <div className="px-4 pb-4">
                <button
                  onClick={() => handleDone(order.id)}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-bold py-2.5 rounded-xl transition-colors text-sm"
                >
                  <CheckCircle className="w-4 h-4" />
                  Listo
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
