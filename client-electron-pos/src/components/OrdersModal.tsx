import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  Clock,
  FileText,
  Printer,
  RotateCcw,
  Search,
  X,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";

import api from "@/services/api";
import type { CartItem, Order, Product, Sale } from "@/types";
import { formatCLP, formatDate } from "@/utils/format";
import ReceiptPreviewModal from "@/components/ReceiptPreviewModal";
import OrderPreviewModal from "@/components/OrderPreviewModal";

interface Props {
  onClose: () => void;
  onLoadOrder: (order: Order, cartItems: CartItem[]) => void;
}

type Tab = "comandas" | "buscar";

const STATUS_LABEL: Record<string, string> = {
  open: "Abierta",
  closed: "Cerrada",
  cancelled: "Cancelada",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "open") {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
        <Clock size={10} /> Abierta
      </span>
    );
  }

  if (status === "closed") {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
        <CheckCircle size={10} /> Cerrada
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
      <XCircle size={10} /> Cancelada
    </span>
  );
}

async function orderToCartItems(order: Order): Promise<CartItem[]> {
  return Promise.all(
    order.items.map(async (orderItem) => {
      try {
        const { data: product } = await api.get<Product>(`/products/${orderItem.product_id}`);
        const unitPrice = product.is_on_offer && product.discount_price
          ? product.discount_price
          : product.sell_price;

        return {
          cartKey: product.id,
          product,
          quantity: orderItem.quantity,
          subtotal: unitPrice * orderItem.quantity,
          unit_price: unitPrice,
        };
      } catch {
        const fallback: Product = {
          id: orderItem.product_id,
          sku: orderItem.product_sku,
          barcode: null,
          name: orderItem.product_name,
          description: null,
          category: null,
          unit: "un",
          cost_price: 0,
          sell_price: orderItem.unit_price,
          tax_rate: 19,
          stock: 9999,
          min_stock: 0,
          is_active: true,
          is_pack: false,
          units_contained: 1,
          base_product_id: null,
          discount_price: null,
          discount_ends_at: null,
          is_on_offer: false,
          created_at: "",
          updated_at: "",
        };

        return {
          cartKey: orderItem.product_id,
          product: fallback,
          quantity: orderItem.quantity,
          subtotal: orderItem.unit_price * orderItem.quantity,
          unit_price: orderItem.unit_price,
        };
      }
    }),
  );
}

export default function OrdersModal({ onClose, onLoadOrder }: Props) {
  const [tab, setTab] = useState<Tab>("comandas");

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const [searchType, setSearchType] = useState<"boleta" | "comanda">("boleta");
  const [searchNum, setSearchNum] = useState("");
  const [searchResult, setSearchResult] = useState<Sale | Order | null>(null);
  const [searching, setSearching] = useState(false);

  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);
  const [previewSale, setPreviewSale] = useState<Sale | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get<Order[]>("/orders/", { params });
      setOrders(data);
    } catch {
      toast.error("Error cargando comandas");
    } finally {
      setLoadingOrders(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (tab === "comandas") void fetchOrders();
  }, [fetchOrders, tab]);

  const handleSearch = async () => {
    const orderNumber = parseInt(searchNum.trim(), 10);
    if (Number.isNaN(orderNumber) || orderNumber <= 0) {
      toast.error("Ingresa un numero valido");
      return;
    }

    setSearching(true);
    setSearchResult(null);
    try {
      if (searchType === "boleta") {
        const { data } = await api.get<Sale>(`/sales/number/${orderNumber}`);
        setSearchResult(data);
      } else {
        const { data } = await api.get<Order>(`/orders/number/${orderNumber}`);
        setSearchResult(data);
      }
    } catch {
      toast.error(`${searchType === "boleta" ? "Boleta" : "Comanda"} Nro ${orderNumber} no encontrada`);
    } finally {
      setSearching(false);
    }
  };

  const handleLoadSelectedOrder = async (order: Order) => {
    if (order.status !== "open") {
      toast.error("Solo se pueden cargar comandas abiertas");
      return;
    }

    const cartItems = await orderToCartItems(order);
    onLoadOrder(order, cartItems);
    onClose();
    toast.success(`Comanda #${order.order_number} cargada al carrito`);
  };

  const handleCancelOrder = async (order: Order) => {
    try {
      await api.post(`/orders/${order.id}/cancel`);
      toast.success("Comanda cancelada");
      setConfirmCancelId(null);
      void fetchOrders();
    } catch {
      toast.error("Error al cancelar");
    }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-lg text-gray-800">Comandas y Boletas</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b px-6">
          <button
            onClick={() => setTab("comandas")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition -mb-px ${
              tab === "comandas" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <ClipboardList size={15} /> Comandas
          </button>
          <button
            onClick={() => setTab("buscar")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition -mb-px ${
              tab === "buscar" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Search size={15} /> Buscar por numero
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "comandas" && (
            <div>
              <div className="flex gap-2 mb-3">
                {["open", "closed", "cancelled", ""].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`text-xs px-3 py-1 rounded-full border transition ${
                      statusFilter === status
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                    }`}
                  >
                    {status === "" ? "Todas" : STATUS_LABEL[status]}
                  </button>
                ))}
                <button onClick={() => void fetchOrders()} className="ml-auto text-gray-400 hover:text-gray-600">
                  <RotateCcw size={15} />
                </button>
              </div>

              {loadingOrders ? (
                <p className="text-center text-gray-400 py-8">Cargando...</p>
              ) : orders.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No hay comandas</p>
              ) : (
                <div className="space-y-2">
                  {orders.map((order) => (
                    <div key={order.id} className="border rounded-xl p-3 hover:bg-gray-50 transition">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800">Comanda #{order.order_number}</span>
                          {order.reference && (
                            <span className="text-sm text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                              {order.reference}
                            </span>
                          )}
                          <StatusBadge status={order.status} />
                        </div>
                        <span className="text-xs text-gray-400">{formatDate(order.created_at)}</span>
                      </div>

                      <div className="text-xs text-gray-500 mb-2">
                        {order.items.length === 0
                          ? "Sin items"
                          : order.items.map((item) => `${item.quantity}x ${item.product_name}`).join(", ")}
                      </div>

                      {order.sale_id && (
                        <div className="text-xs text-green-600 mb-2">Vinculada a venta</div>
                      )}

                      {confirmCancelId === order.id ? (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                          <AlertTriangle size={14} className="text-red-500 shrink-0" />
                          <p className="text-xs text-red-700 font-semibold flex-1">
                            Cancelar Comanda #{order.order_number}?
                          </p>
                          <button
                            onClick={() => void handleCancelOrder(order)}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-semibold transition"
                          >
                            Si, cancelar
                          </button>
                          <button
                            onClick={() => setConfirmCancelId(null)}
                            className="text-xs bg-white hover:bg-gray-100 text-gray-600 border border-gray-300 px-3 py-1.5 rounded-lg font-medium transition"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          {order.status === "open" && (
                            <>
                              <button
                                onClick={() => void handleLoadSelectedOrder(order)}
                                className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition"
                              >
                                <ClipboardList size={12} /> Cargar al carrito
                              </button>
                              <button
                                onClick={() => setPreviewOrder(order)}
                                className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition"
                              >
                                <Printer size={12} /> Preview
                              </button>
                              <button
                                onClick={() => setConfirmCancelId(order.id)}
                                className="flex items-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg transition"
                              >
                                <XCircle size={12} /> Cancelar
                              </button>
                            </>
                          )}
                          {order.status !== "open" && (
                            <button
                              onClick={() => setPreviewOrder(order)}
                              className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition"
                            >
                              <Printer size={12} /> Preview comanda
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "buscar" && (
            <div>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => { setSearchType("boleta"); setSearchResult(null); }}
                  className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition ${
                    searchType === "boleta" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  <FileText size={14} /> Boleta
                </button>
                <button
                  onClick={() => { setSearchType("comanda"); setSearchResult(null); }}
                  className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition ${
                    searchType === "comanda" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  <ClipboardList size={14} /> Comanda
                </button>
              </div>

              <div className="flex gap-2 mb-4">
                <input
                  type="number"
                  value={searchNum}
                  onChange={(event) => setSearchNum(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void handleSearch()}
                  placeholder={`Nro de ${searchType === "boleta" ? "boleta" : "comanda"}...`}
                  className="flex-1 border-2 rounded-xl px-4 py-2.5 text-lg focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <button
                  onClick={() => void handleSearch()}
                  disabled={searching}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-5 rounded-xl font-medium transition"
                >
                  {searching ? "..." : <Search size={18} />}
                </button>
              </div>

              {searchResult && "sale_number" in searchResult && (
                <div className="border rounded-xl p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-gray-800">
                      Boleta #{searchResult.sale_number}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(searchResult.created_at)}</span>
                  </div>

                  <div className="space-y-1 mb-3">
                    {searchResult.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-gray-700">{item.quantity}x {item.product_name}</span>
                        <span className="text-gray-600">{formatCLP(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-2 flex justify-between font-bold text-gray-800">
                    <span>TOTAL</span>
                    <span>{formatCLP(searchResult.total)}</span>
                  </div>

                  <button
                    onClick={() => setPreviewSale(searchResult)}
                    className="mt-3 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium w-full justify-center transition"
                  >
                    <Printer size={15} /> Preview Boleta
                  </button>
                </div>
              )}

              {searchResult && "order_number" in searchResult && (
                <div className="border rounded-xl p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800">
                        Comanda #{searchResult.order_number}
                      </span>
                      {searchResult.reference && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          {searchResult.reference}
                        </span>
                      )}
                      <StatusBadge status={searchResult.status} />
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(searchResult.created_at)}</span>
                  </div>

                  <div className="space-y-1 mb-3">
                    {searchResult.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-gray-700">{item.quantity}x {item.product_name}</span>
                        <span className="text-gray-600">{formatCLP(item.unit_price)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    {searchResult.status === "open" && (
                      <button
                        onClick={() => void handleLoadSelectedOrder(searchResult)}
                        className="flex-1 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium justify-center transition"
                      >
                        <ClipboardList size={15} /> Cargar al carrito
                      </button>
                    )}
                    <button
                      onClick={() => setPreviewOrder(searchResult)}
                      className="flex-1 flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium justify-center transition"
                    >
                      <Printer size={15} /> Preview Comanda
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {previewSale && (
        <ReceiptPreviewModal
          sale={previewSale}
          onClose={() => setPreviewSale(null)}
        />
      )}

      {previewOrder && (
        <OrderPreviewModal
          order={previewOrder}
          onClose={() => setPreviewOrder(null)}
        />
      )}
    </div>
  );
}
