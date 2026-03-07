import { useState, useEffect, useCallback } from "react";
import {
  X, Search, Printer, RotateCcw, ClipboardList, FileText, CheckCircle,
  XCircle, Clock, AlertTriangle
} from "lucide-react";
import api from "@/services/api";
import toast from "react-hot-toast";
import type { Order, Sale, CartItem, Product } from "@/types";
import { formatCLP, formatDate } from "@/utils/format";
import { buildOrderContent, buildReceiptContent } from "@/services/printer";
import { getSavedPrinterName } from "@/pages/SettingsPage";

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
  if (status === "open") return (
    <span className="flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
      <Clock size={10} /> Abierta
    </span>
  );
  if (status === "closed") return (
    <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
      <CheckCircle size={10} /> Cerrada
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
      <XCircle size={10} /> Cancelada
    </span>
  );
}

async function printOrder(order: Order) {
  if (!window.electronAPI) { toast.error("Impresión solo disponible en app de escritorio"); return; }
  const printerName = getSavedPrinterName();
  if (!printerName) { toast.error("Configura una impresora en Configuración"); return; }
  const content = buildOrderContent(order);
  const result = await window.electronAPI.printReceipt({ content, printerName });
  if (result.success) toast.success("Comanda impresa");
  else toast.error(`Error: ${result.error}`);
}

async function printSale(sale: Sale) {
  if (!window.electronAPI) { toast.error("Impresión solo disponible en app de escritorio"); return; }
  const printerName = getSavedPrinterName();
  if (!printerName) { toast.error("Configura una impresora en Configuración"); return; }
  const content = buildReceiptContent(sale);
  const result = await window.electronAPI.printReceipt({ content, printerName });
  if (result.success) toast.success("Boleta impresa");
  else toast.error(`Error: ${result.error}`);
}

/** Converts Order items to CartItem[], fetching live product data */
async function orderToCartItems(order: Order): Promise<CartItem[]> {
  return Promise.all(
    order.items.map(async (oi) => {
      try {
        const { data: product } = await api.get<Product>(`/products/${oi.product_id}`);
        const unitPrice = product.is_on_offer && product.discount_price
          ? product.discount_price : product.sell_price;
        return {
          cartKey: product.id,
          product,
          quantity: oi.quantity,
          subtotal: unitPrice * oi.quantity,
          unit_price: unitPrice,
        };
      } catch {
        const fallback: Product = {
          id: oi.product_id, sku: oi.product_sku, barcode: null,
          name: oi.product_name, description: null, category: null, unit: "un",
          cost_price: 0, sell_price: oi.unit_price, tax_rate: 19,
          stock: 9999, min_stock: 0, is_active: true,
          is_pack: false, units_contained: 1, base_product_id: null,
          discount_price: null, discount_ends_at: null, is_on_offer: false,
          created_at: "", updated_at: "",
        };
        return {
          cartKey: oi.product_id,
          product: fallback,
          quantity: oi.quantity,
          subtotal: oi.unit_price * oi.quantity,
          unit_price: oi.unit_price,
        };
      }
    })
  );
}

export default function OrdersModal({ onClose, onLoadOrder }: Props) {
  const [tab, setTab] = useState<Tab>("comandas");

  // Comandas tab
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  // Buscar tab
  const [searchType, setSearchType] = useState<"boleta" | "comanda">("boleta");
  const [searchNum, setSearchNum] = useState("");
  const [searchResult, setSearchResult] = useState<Sale | Order | null>(null);
  const [searching, setSearching] = useState(false);

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
    if (tab === "comandas") fetchOrders();
  }, [tab, fetchOrders]);

  const handleSearch = async () => {
    const n = parseInt(searchNum.trim(), 10);
    if (isNaN(n) || n <= 0) { toast.error("Ingresa un número válido"); return; }
    setSearching(true);
    setSearchResult(null);
    try {
      if (searchType === "boleta") {
        const { data } = await api.get<Sale>(`/sales/number/${n}`);
        setSearchResult(data);
      } else {
        const { data } = await api.get<Order>(`/orders/number/${n}`);
        setSearchResult(data);
      }
    } catch {
      toast.error(`${searchType === "boleta" ? "Boleta" : "Comanda"} N° ${n} no encontrada`);
    } finally {
      setSearching(false);
    }
  };

  const handleLoadOrder = async (order: Order) => {
    if (order.status !== "open") { toast.error("Solo se pueden cargar comandas abiertas"); return; }
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
      fetchOrders();
    } catch {
      toast.error("Error al cancelar");
    }
  };

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-lg text-gray-800">Comandas y Boletas</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
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
            <Search size={15} /> Buscar por número
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* COMANDAS TAB */}
          {tab === "comandas" && (
            <div>
              <div className="flex gap-2 mb-3">
                {["open", "closed", "cancelled", ""].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`text-xs px-3 py-1 rounded-full border transition ${
                      statusFilter === s
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                    }`}
                  >
                    {s === "" ? "Todas" : STATUS_LABEL[s]}
                  </button>
                ))}
                <button onClick={fetchOrders} className="ml-auto text-gray-400 hover:text-gray-600">
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
                          : order.items.map((i) => `${i.quantity}x ${i.product_name}`).join(", ")}
                      </div>
                      {order.sale_id && (
                        <div className="text-xs text-green-600 mb-2">Vinculada a venta</div>
                      )}
                      {confirmCancelId === order.id ? (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                          <AlertTriangle size={14} className="text-red-500 shrink-0" />
                          <p className="text-xs text-red-700 font-semibold flex-1">
                            ¿Cancelar Comanda #{order.order_number}?
                          </p>
                          <button
                            onClick={() => handleCancelOrder(order)}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-semibold transition"
                          >
                            Sí, cancelar
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
                                onClick={() => handleLoadOrder(order)}
                                className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition"
                              >
                                <ClipboardList size={12} /> Cargar al carrito
                              </button>
                              <button
                                onClick={() => printOrder(order)}
                                className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition"
                              >
                                <Printer size={12} /> Imprimir
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
                              onClick={() => printOrder(order)}
                              className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition"
                            >
                              <Printer size={12} /> Reimprimir comanda
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

          {/* BUSCAR TAB */}
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
                  onChange={(e) => setSearchNum(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder={`N° de ${searchType === "boleta" ? "boleta" : "comanda"}...`}
                  className="flex-1 border-2 rounded-xl px-4 py-2.5 text-lg focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-5 rounded-xl font-medium transition"
                >
                  {searching ? "..." : <Search size={18} />}
                </button>
              </div>

              {/* Result: Sale */}
              {searchResult && "sale_number" in searchResult && (
                <div className="border rounded-xl p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-gray-800">
                      Boleta #{(searchResult as Sale).sale_number}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate((searchResult as Sale).created_at)}</span>
                  </div>
                  <div className="space-y-1 mb-3">
                    {(searchResult as Sale).items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-gray-700">{item.quantity}x {item.product_name}</span>
                        <span className="text-gray-600">{formatCLP(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold text-gray-800">
                    <span>TOTAL</span>
                    <span>{formatCLP((searchResult as Sale).total)}</span>
                  </div>
                  <button
                    onClick={() => printSale(searchResult as Sale)}
                    className="mt-3 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium w-full justify-center transition"
                  >
                    <Printer size={15} /> Reimprimir Boleta
                  </button>
                </div>
              )}

              {/* Result: Order */}
              {searchResult && "order_number" in searchResult && (
                <div className="border rounded-xl p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800">
                        Comanda #{(searchResult as Order).order_number}
                      </span>
                      {(searchResult as Order).reference && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          {(searchResult as Order).reference}
                        </span>
                      )}
                      <StatusBadge status={(searchResult as Order).status} />
                    </div>
                    <span className="text-xs text-gray-400">{formatDate((searchResult as Order).created_at)}</span>
                  </div>
                  <div className="space-y-1 mb-3">
                    {(searchResult as Order).items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-gray-700">{item.quantity}x {item.product_name}</span>
                        <span className="text-gray-600">{formatCLP(item.unit_price)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    {(searchResult as Order).status === "open" && (
                      <button
                        onClick={() => handleLoadOrder(searchResult as Order)}
                        className="flex-1 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium justify-center transition"
                      >
                        <ClipboardList size={15} /> Cargar al carrito
                      </button>
                    )}
                    <button
                      onClick={() => printOrder(searchResult as Order)}
                      className="flex-1 flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium justify-center transition"
                    >
                      <Printer size={15} /> Reimprimir Comanda
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
