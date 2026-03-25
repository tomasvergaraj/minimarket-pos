import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ChefHat,
  ClipboardList,
  Gift,
  LogOut,
  Minus,
  Monitor,
  Percent,
  Plus,
  Printer,
  Save,
  Search,
  Settings,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import { useAuthStore } from "@/stores/authStore";
import { useCartStore } from "@/stores/cartStore";
import { formatCLP } from "@/utils/format";
import api from "@/services/api";
import type { CartItem, Customer, LoyaltyConfig, Order, Product, Promotion, Sale, TableStatus } from "@/types";
import { computePromotion } from "@/utils/promotions";
import PaymentModal from "@/components/PaymentModal";
import CloseSessionModal from "@/components/CloseSessionModal";
import ReceiptPreviewModal from "@/components/ReceiptPreviewModal";
import OrderPreviewModal from "@/components/OrderPreviewModal";
import FavoritesPanel from "@/components/FavoritesPanel";
import CategoryGrid from "@/components/CategoryGrid";
import OrdersModal from "@/components/OrdersModal";
import TableMapModal from "@/components/TableMapModal";
import nexoIconUrl from "../assets/nexo-icon.svg";

function stockColor(stock: number, minStock: number) {
  if (stock <= 0) return "text-red-600 font-semibold";
  if (stock <= minStock) return "text-yellow-600 font-semibold";
  return "text-green-600";
}

function StockBadge({ remaining, minStock }: { remaining: number; minStock: number }) {
  if (remaining > minStock) return null;

  if (remaining <= 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-red-600 font-semibold">
        <AlertTriangle size={11} /> Sin stock disponible
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs text-yellow-600 font-semibold">
      <AlertTriangle size={11} /> Solo quedan {remaining}
    </span>
  );
}

/** Inline discount editor for a cart item */
function DiscountEditor({
  item,
  onApply,
  onClose,
}: {
  item: CartItem;
  onApply: (newPrice: number) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"pct" | "fixed">("pct");
  const [value, setValue] = useState("");

  const originalPrice = item.product.is_on_offer && item.product.discount_price
    ? item.product.discount_price
    : item.product.sell_price;

  const previewPrice = (() => {
    const n = parseFloat(value);
    if (isNaN(n) || n < 0) return originalPrice;
    if (mode === "pct") return Math.round(originalPrice * (1 - n / 100));
    return Math.round(originalPrice - n);
  })();

  const isValid = previewPrice >= 0 && previewPrice <= originalPrice;

  return (
    <div className="mt-1 bg-blue-50 border border-blue-200 rounded-lg p-2">
      <div className="flex items-center gap-1 mb-1.5">
        <button
          onClick={() => setMode("pct")}
          className={`text-xs px-2 py-0.5 rounded transition ${mode === "pct" ? "bg-blue-600 text-white" : "bg-white text-blue-600 border border-blue-300"}`}
        >
          %
        </button>
        <button
          onClick={() => setMode("fixed")}
          className={`text-xs px-2 py-0.5 rounded transition ${mode === "fixed" ? "bg-blue-600 text-white" : "bg-white text-blue-600 border border-blue-300"}`}
        >
          $
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={mode === "pct" ? "% descuento" : "$ a descontar"}
          className="flex-1 text-xs border rounded px-2 py-0.5 focus:outline-none focus:border-blue-500"
          autoFocus
          min="0"
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-blue-700">
          Precio: {formatCLP(originalPrice)} → <strong>{formatCLP(previewPrice)}</strong>
        </span>
        <div className="flex gap-1">
          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-0.5"
          >
            Cancelar
          </button>
          <button
            onClick={() => { if (isValid && previewPrice >= 0) { onApply(previewPrice); onClose(); } }}
            disabled={!isValid || value === ""}
            className="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-2 py-0.5 rounded transition"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function POSPage() {
  const { user, register } = useAuthStore();
  const { items, addItem, removeItem, updateQuantity, updatePrice, clear, total } = useCartStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [showCloseSession, setShowCloseSession] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);
  const [discountOpenKey, setDiscountOpenKey] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<number | null>(null);
  const pendingBarcodeLookupsRef = useRef<Set<string>>(new Set());
  const navigate = useNavigate();

  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [showOrderRef, setShowOrderRef] = useState(false);
  const [showTableMap, setShowTableMap] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
  const [orderRef, setOrderRef] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const [customerDisplayOpen, setCustomerDisplayOpen] = useState(false);
  const [kitchenDisplayOpen, setKitchenDisplayOpen] = useState(false);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promoLabels, setPromoLabels] = useState<Record<string, string | null>>({});

  // Loyalty / customer
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig>({ points_per_thousand: 1, point_value: 10 });
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  // Keep customer display in sync with cart
  useEffect(() => {
    window.electronAPI?.updateCustomerDisplay?.({
      phase: items.length > 0 ? "selling" : "idle",
      storeName: "Nexo",
      items: items.map((i) => ({
        name: i.product.name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        subtotal: i.subtotal,
      })),
      total: total(),
    });
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync display open state on mount
  useEffect(() => {
    window.electronAPI?.isCustomerDisplayOpen?.().then(setCustomerDisplayOpen).catch(() => {});
  }, []);

  // Fetch active promotions on mount
  useEffect(() => {
    api.get("/promotions/active")
      .then(({ data }) => setPromotions(Array.isArray(data) ? data : (data.data ?? [])))
      .catch(() => {});
  }, []);

  // Fetch loyalty config on mount
  useEffect(() => {
    api.get("/customers/loyalty-config")
      .then(({ data }) => setLoyaltyConfig(data))
      .catch(() => {});
  }, []);

  const applyPromoToItem = useCallback((product: Product, qty: number, cartKey: string) => {
    if (promotions.length === 0) return;
    const { price, label } = computePromotion(product, qty, promotions);
    const base = product.is_on_offer && product.discount_price ? product.discount_price : product.sell_price;
    if (price !== base) updatePrice(cartKey, price);
    setPromoLabels((prev) => ({ ...prev, [cartKey]: label }));
  }, [promotions, updatePrice]);

  const tryAddItem = useCallback((product: Product) => {
    if (product.stock <= 0) {
      toast.error(`${product.name}: sin stock`);
      return;
    }
    const ok = addItem(product, 1);
    if (!ok) {
      toast.error(`Stock insuficiente - disponibles: ${product.stock}`);
    } else {
      applyPromoToItem(product, 1, product.id);
      toast.success(`${product.name} agregado`);
    }
  }, [addItem, applyPromoToItem]);

  const handleQuantityChange = useCallback((cartKey: string, newQty: number) => {
    const item = useCartStore.getState().items.find((i) => i.cartKey === cartKey);
    if (!item) return;
    const ok = updateQuantity(cartKey, newQty);
    if (!ok) {
      toast.error("Stock insuficiente");
      return;
    }
    if (newQty > 0) applyPromoToItem(item.product, newQty, cartKey);
    else setPromoLabels((prev) => { const n = { ...prev }; delete n[cartKey]; return n; });
  }, [updateQuantity, applyPromoToItem]);

  const clearScheduledSearch = useCallback(() => {
    if (searchTimeoutRef.current !== null) {
      window.clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
  }, []);

  const handleSearch = useCallback(async (query: string, options?: { immediate?: boolean }) => {
    const trimmed = query.trim();

    if (options?.immediate) clearScheduledSearch();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }

    try {
      if (/^\d+$/.test(trimmed)) {
        if (pendingBarcodeLookupsRef.current.has(trimmed)) return;

        pendingBarcodeLookupsRef.current.add(trimmed);
        try {
          const { data } = await api.get(`/products/barcode/${trimmed}`);
          tryAddItem(data);
          setSearchQuery((current) => (current.trim() === trimmed ? "" : current));
          setSearchResults([]);
          return;
        } catch {
          // Falls back to normal product search when the barcode route misses.
        } finally {
          pendingBarcodeLookupsRef.current.delete(trimmed);
        }
      }

      const { data } = await api.get("/products/", { params: { search: trimmed } });
      setSearchResults(data);
    } catch {
      toast.error("Error buscando productos");
    }
  }, [clearScheduledSearch, tryAddItem]);

  useEffect(() => {
    clearScheduledSearch();

    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = window.setTimeout(() => {
      searchTimeoutRef.current = null;
      void handleSearch(searchQuery);
    }, 300);

    return clearScheduledSearch;
  }, [clearScheduledSearch, handleSearch, searchQuery]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const searchFocused = document.activeElement === searchRef.current;
      const inInput = document.activeElement instanceof HTMLInputElement
        || document.activeElement instanceof HTMLTextAreaElement;

      // F1 / F2 → focus search
      if (event.key === "F1" || event.key === "F2") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }

      // F3 → clear cart
      if (event.key === "F3" && items.length > 0) {
        event.preventDefault();
        clear();
        resetOrderDraft();
        toast("Carrito limpiado", { icon: "🗑️" });
        return;
      }

      // F4 → open payment
      if (event.key === "F4" && items.length > 0) {
        event.preventDefault();
        setShowPayment(true);
        return;
      }

      // Escape → close search results / blur
      if (event.key === "Escape" && searchFocused) {
        event.preventDefault();
        setSearchQuery("");
        setSearchResults([]);
        searchRef.current?.blur();
        return;
      }

      // +/- and Delete only when search is NOT focused
      if (inInput) return;

      const lastItem = items[items.length - 1];
      if (!lastItem) return;

      // NumpadAdd / + key → increment last item
      if (event.key === "+" || event.key === "NumpadAdd") {
        event.preventDefault();
        handleQuantityChange(lastItem.cartKey, lastItem.quantity + 1);
        return;
      }

      // NumpadSubtract / - key → decrement last item
      if (event.key === "-" || event.key === "NumpadSubtract") {
        event.preventDefault();
        handleQuantityChange(lastItem.cartKey, lastItem.quantity - 1);
        return;
      }

      // Delete → remove last item
      if (event.key === "Delete") {
        event.preventDefault();
        removeItem(lastItem.cartKey);
        toast(`${lastItem.product.name} eliminado`, { icon: "✕" });
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const handleSearchKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleSearch(searchQuery, { immediate: true });
    }
  };

  const resetOrderDraft = useCallback(() => {
    setActiveOrder(null);
    setOrderRef("");
    setOrderNotes("");
    setShowOrderRef(false);
    setSelectedTableId(null);
    setSelectedTableName(null);
  }, []);

  const resetCustomer = useCallback(() => {
    setSelectedCustomer(null);
    setCustomerSearch("");
    setCustomerResults([]);
    setPointsToRedeem(0);
  }, []);

  const handleCustomerSearch = useCallback(async (q: string) => {
    setCustomerSearch(q);
    if (q.trim().length < 2) { setCustomerResults([]); return; }
    setCustomerSearching(true);
    try {
      const { data } = await api.get("/customers/search", { params: { q: q.trim(), limit: 6 } });
      setCustomerResults(Array.isArray(data) ? data : []);
    } catch {
      setCustomerResults([]);
    } finally {
      setCustomerSearching(false);
    }
  }, []);

  const toggleCustomerDisplay = async () => {
    if (customerDisplayOpen) {
      await window.electronAPI?.closeCustomerDisplay?.();
      setCustomerDisplayOpen(false);
    } else {
      await window.electronAPI?.openCustomerDisplay?.();
      setCustomerDisplayOpen(true);
    }
  };

  const handlePaymentComplete = (sale: Sale, showReceipt: boolean) => {
    window.electronAPI?.updateCustomerDisplay?.({
      phase: "paid",
      storeName: "Nexo",
      items: [],
      total: sale.total,
      cashReceived: sale.cash_amount > 0 ? sale.cash_amount : undefined,
      change: sale.change_amount > 0 ? sale.change_amount : undefined,
      paymentMethod: sale.payment_method,
    });
    clear();
    resetOrderDraft();
    resetCustomer();
    setShowPayment(false);
    const earned = (sale as Sale & { points_earned?: number }).points_earned ?? 0;
    if (earned > 0) {
      toast.success(`Venta #${sale.sale_number} completada · +${earned} pts`);
    } else {
      toast.success(`Venta #${sale.sale_number} completada`);
    }
    if (showReceipt) {
      setLastSale(sale);
    }
    searchRef.current?.focus();
  };

  const handleLoadOrder = (order: Order, cartItems: CartItem[]) => {
    clear();
    cartItems.forEach((cartItem) => addItem(cartItem.product, cartItem.quantity));
    setActiveOrder(order);
    setOrderRef(order.reference ?? "");
    setOrderNotes(order.notes ?? "");
    setSelectedTableId(order.table_id ?? null);
    setSelectedTableName(order.table_id ? (order.reference ?? null) : null);
    setShowOrderRef(false);
  };

  const handleSaveOrder = async () => {
    if (items.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }
    if (!register) {
      toast.error("Sin caja seleccionada");
      return;
    }

    setSavingOrder(true);
    try {
      const payload = {
        register_id: register.id,
        reference: orderRef.trim() || null,
        notes: orderNotes.trim() || null,
        table_id: selectedTableId ?? null,
        items: items.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
      };

      let savedOrder: Order;
      if (activeOrder) {
        const { data } = await api.patch<Order>(`/orders/${activeOrder.id}`, {
          items: payload.items,
          reference: payload.reference,
          notes: payload.notes,
        });
        savedOrder = data;
        toast.success(`Comanda #${savedOrder.order_number} actualizada`);
      } else {
        const { data } = await api.post<Order>("/orders/", payload);
        savedOrder = data;
        toast.success(`Comanda #${savedOrder.order_number} guardada`);
      }

      setActiveOrder(savedOrder);
      setOrderRef(savedOrder.reference ?? "");
      setOrderNotes(savedOrder.notes ?? "");
      setShowOrderRef(false);
      setPreviewOrder(savedOrder);
    } catch {
      toast.error("Error guardando comanda");
    } finally {
      setSavingOrder(false);
    }
  };

  const handleReprintOrder = () => {
    if (!activeOrder) return;
    setPreviewOrder(activeOrder);
  };

  const handleClearActiveOrder = () => {
    clear();
    resetOrderDraft();
    resetCustomer();
  };

  const loyaltyDiscount = Math.min(
    pointsToRedeem * loyaltyConfig.point_value,
    total()
  );
  const effectiveTotal = Math.max(0, total() - loyaltyDiscount);

  const showFavorites = searchResults.length === 0;

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-white border-b px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <img src={nexoIconUrl} alt="Nexo" className="w-8 h-8 rounded-lg" />
            <h1 className="font-bold text-lg text-blue-600">Nexo</h1>
          </div>
          <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
            {register?.name}
          </span>
          <span className="text-sm text-gray-500">{user?.full_name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void toggleCustomerDisplay()}
            title={customerDisplayOpen ? "Cerrar pantalla cliente" : "Abrir pantalla cliente"}
            className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg transition ${
              customerDisplayOpen
                ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            <Monitor size={16} />
          </button>
          <button
            onClick={async () => {
              if (kitchenDisplayOpen) {
                await window.electronAPI?.closeKitchenDisplay?.();
                setKitchenDisplayOpen(false);
              } else {
                await window.electronAPI?.openKitchenDisplay?.();
                setKitchenDisplayOpen(true);
              }
            }}
            title={kitchenDisplayOpen ? "Cerrar pantalla cocina" : "Abrir pantalla cocina (KDS)"}
            className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg transition ${
              kitchenDisplayOpen
                ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            <ChefHat size={16} />
          </button>
          <button
            onClick={() => setShowOrders(true)}
            className="flex items-center gap-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition"
          >
            <ClipboardList size={16} /> Comandas
          </button>
          <button onClick={() => navigate("/settings")} className="p-2 text-gray-400 hover:text-gray-600">
            <Settings size={20} />
          </button>
          <button
            onClick={() => setShowCloseSession(true)}
            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <LogOut size={16} /> Cerrar Caja
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col p-4 overflow-y-auto">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-10 pr-10 py-3 border-2 border-gray-200 rounded-xl text-lg focus:border-blue-500 focus:outline-none"
              placeholder="Escanear código o buscar producto... (F2)"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm mb-4 max-h-72 overflow-y-auto">
              {searchResults.map((product) => {
                const reserved = items
                  .filter((item) => item.product.id === product.id)
                  .reduce((sum, item) => sum + item.quantity, 0);
                const remaining = product.stock - reserved;
                const outOfStock = remaining <= 0;
                const displayPrice = product.is_on_offer && product.discount_price
                  ? product.discount_price
                  : product.sell_price;

                return (
                  <button
                    key={product.id}
                    className="w-full border-b last:border-0 text-left hover:bg-blue-50 active:bg-blue-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={outOfStock}
                    onClick={() => {
                      if (outOfStock) return;
                      tryAddItem(product);
                      setSearchQuery("");
                      setSearchResults([]);
                      searchRef.current?.focus();
                    }}
                  >
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <div className="text-left flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-gray-800 text-sm">{product.name}</p>
                          {product.is_pack && (
                            <span className="text-xs font-bold text-white bg-purple-600 px-1.5 py-0.5 rounded">
                              Pack x{product.units_contained}
                            </span>
                          )}
                          {product.is_on_offer && (
                            <span className="text-xs font-bold text-white bg-red-500 px-1.5 py-0.5 rounded">
                              OFERTA
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {product.sku}
                          {" | "}
                          <span className={stockColor(remaining, product.min_stock)}>
                            Stock: {product.stock}{reserved > 0 && ` (${reserved} reservados)`}
                          </span>
                        </p>
                        <StockBadge remaining={remaining} minStock={product.min_stock} />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {product.is_on_offer && product.discount_price ? (
                          <div className="text-right">
                            <p className="text-xs text-gray-400 line-through">{formatCLP(product.sell_price)}</p>
                            <p className="font-bold text-red-600 text-base">{formatCLP(product.discount_price)}</p>
                          </div>
                        ) : (
                          <span className="font-bold text-blue-600 text-base">{formatCLP(displayPrice)}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {showFavorites && (
            <>
              <CategoryGrid onProductClick={tryAddItem} cartItems={items} promotions={promotions} />
              <FavoritesPanel onProductClick={tryAddItem} />
            </>
          )}

          {/* Shortcut hint bar */}
          <div className="mt-auto pt-4 flex flex-wrap gap-x-4 gap-y-1">
            {[
              ["F1", "Buscar"],
              ["F3", "Limpiar"],
              ["F4", "Cobrar"],
              ["+/-", "Cantidad"],
              ["Del", "Quitar ítem"],
              ["Esc", "Cerrar"],
            ].map(([key, label]) => (
              <span key={key} className="flex items-center gap-1 text-[11px] text-gray-400">
                <kbd className="bg-gray-100 text-gray-500 border border-gray-300 rounded px-1 py-0.5 font-mono text-[10px] leading-none">
                  {key}
                </kbd>
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="w-[420px] bg-white border-l flex flex-col">
          {activeOrder && (
            <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <ClipboardList size={14} />
                <span className="font-semibold">Comanda #{activeOrder.order_number}</span>
                {activeOrder.reference && (
                  <span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full text-xs">
                    {activeOrder.reference}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleReprintOrder}
                  className="text-blue-500 hover:text-blue-700 p-1"
                  title="Ver comanda"
                >
                  <Printer size={14} />
                </button>
                <button
                  onClick={handleClearActiveOrder}
                  className="text-blue-400 hover:text-blue-600 p-1"
                  title="Descartar comanda"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Customer loyalty strip */}
          <div className="px-4 py-2 border-b bg-gray-50">
            {selectedCustomer ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <UserCheck size={14} className="text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800 truncate">{selectedCustomer.name}</p>
                    <p className="text-[11px] text-amber-600 font-medium">{selectedCustomer.points_balance} pts disponibles</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {selectedCustomer.points_balance > 0 && (
                    <div className="flex items-center gap-1">
                      <Gift size={12} className="text-amber-500" />
                      <input
                        type="number"
                        min={0}
                        max={selectedCustomer.points_balance}
                        value={pointsToRedeem || ""}
                        onChange={(e) => {
                          const v = Math.min(Math.max(0, parseInt(e.target.value) || 0), selectedCustomer.points_balance);
                          setPointsToRedeem(v);
                        }}
                        placeholder="0 pts"
                        className="w-16 text-[11px] border border-amber-300 rounded px-1.5 py-1 text-center focus:outline-none focus:border-amber-500"
                      />
                      {loyaltyDiscount > 0 && (
                        <span className="text-[11px] text-emerald-600 font-semibold">−${loyaltyDiscount.toLocaleString("es-CL")}</span>
                      )}
                    </div>
                  )}
                  <button onClick={resetCustomer} className="text-gray-400 hover:text-gray-600 p-1">
                    <X size={13} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <UserCheck size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => void handleCustomerSearch(e.target.value)}
                  placeholder="Buscar cliente (teléfono, RUT…)"
                  className="w-full pl-7 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400"
                />
                {customerSearching && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">…</span>
                )}
                {customerResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 border-b last:border-0 text-[12px]"
                        onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); setCustomerResults([]); setPointsToRedeem(0); }}
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="text-gray-400 ml-2">{c.phone ?? c.rut ?? ""}</span>
                        <span className="text-amber-600 ml-2 text-[11px]">{c.points_balance} pts</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800 text-lg">Carrito</h2>
              {items.length > 0 && (
                <button
                  onClick={handleClearActiveOrder}
                  className="text-red-500 hover:text-red-600 text-sm flex items-center gap-1"
                >
                  <Trash2 size={14} /> Limpiar
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p>Escanee o busque productos</p>
              </div>
            ) : (
              <div className="divide-y">
                {items.map((item) => {
                  const reservedForOthers = items
                    .filter((other) => other.product.id === item.product.id && other.cartKey !== item.cartKey)
                    .reduce((sum, other) => sum + other.quantity, 0);
                  const remaining = item.product.stock - reservedForOthers - item.quantity;
                  const atLimit = item.quantity + 1 > item.product.stock - reservedForOthers;
                  const originalPrice = item.product.is_on_offer && item.product.discount_price
                    ? item.product.discount_price
                    : item.product.sell_price;
                  const hasDiscount = item.unit_price < originalPrice;

                  return (
                    <div key={item.cartKey} className="p-3 hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex-1 pr-2">
                          <p className="font-medium text-gray-800 text-sm">{item.product.name}</p>
                          {item.product.is_pack && (
                            <span className="text-xs text-purple-600 font-semibold">Pack x{item.product.units_contained}</span>
                          )}
                          {promoLabels[item.cartKey] ? (
                            <span className="text-xs text-green-600 font-semibold ml-1">{promoLabels[item.cartKey]}</span>
                          ) : item.product.is_on_offer && (
                            <span className="text-xs text-red-600 font-semibold ml-1">OFERTA</span>
                          )}
                        </div>
                        <button onClick={() => removeItem(item.cartKey)} className="text-red-400 hover:text-red-600 shrink-0">
                          <X size={16} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleQuantityChange(item.cartKey, item.quantity - 1)}
                            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-10 text-center font-mono font-bold">{item.quantity}</span>
                          <button
                            onClick={() => handleQuantityChange(item.cartKey, item.quantity + 1)}
                            disabled={atLimit}
                            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg"
                          >
                            <Plus size={14} />
                          </button>
                          {/* Discount button */}
                          <button
                            onClick={() => setDiscountOpenKey(discountOpenKey === item.cartKey ? null : item.cartKey)}
                            title="Aplicar descuento"
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition ${
                              hasDiscount
                                ? "bg-orange-100 text-orange-600 hover:bg-orange-200"
                                : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                            }`}
                          >
                            <Percent size={13} />
                          </button>
                        </div>
                        <div className="text-right">
                          {hasDiscount && (
                            <p className="text-xs text-gray-400 line-through">
                              {formatCLP(originalPrice)} c/u
                            </p>
                          )}
                          {item.product.is_on_offer && item.product.discount_price && !hasDiscount && (
                            <p className="text-xs text-gray-400 line-through">
                              {formatCLP(item.product.sell_price)} c/u
                            </p>
                          )}
                          <p className={`text-xs font-semibold ${hasDiscount ? "text-orange-500" : item.product.is_on_offer ? "text-red-500" : "text-gray-500"}`}>
                            {formatCLP(item.unit_price)} c/u
                          </p>
                          <p className="font-bold text-gray-800">{formatCLP(item.subtotal)}</p>
                        </div>
                      </div>

                      {discountOpenKey === item.cartKey && (
                        <DiscountEditor
                          item={item}
                          onApply={(newPrice) => {
                            updatePrice(item.cartKey, newPrice);
                            toast.success(`Descuento aplicado: ${formatCLP(newPrice)} c/u`);
                          }}
                          onClose={() => setDiscountOpenKey(null)}
                        />
                      )}

                      <div className="mt-1">
                        <StockBadge remaining={remaining} minStock={item.product.min_stock} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total</span>
              <div className="text-right">
                {loyaltyDiscount > 0 && (
                  <p className="text-sm text-gray-400 line-through">{formatCLP(total())}</p>
                )}
                <span className="text-3xl font-bold text-gray-800">{formatCLP(effectiveTotal)}</span>
              </div>
            </div>

            {showOrderRef ? (
              <div className="space-y-2">
                {/* Table selector */}
                {!activeOrder && (
                  <button
                    type="button"
                    onClick={() => setShowTableMap(true)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition ${
                      selectedTableId
                        ? "border-blue-400 bg-blue-50 text-blue-700 font-medium"
                        : "border-gray-200 hover:border-blue-300 text-gray-500 hover:text-blue-600"
                    }`}
                  >
                    <span>{selectedTableName ? `Mesa: ${selectedTableName}` : "Seleccionar mesa (opcional)"}</span>
                    {selectedTableId && (
                      <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); setSelectedTableId(null); setSelectedTableName(null); }}
                        className="text-blue-400 hover:text-blue-700 ml-2"
                      >×</span>
                    )}
                  </button>
                )}
                <input
                  value={orderRef}
                  onChange={(event) => setOrderRef(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSaveOrder();
                    }
                    if (event.key === "Escape") setShowOrderRef(false);
                  }}
                  placeholder='Referencia opcional (ej: "Mesa 3")'
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <textarea
                  value={orderNotes}
                  onChange={(event) => setOrderNotes(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                      event.preventDefault();
                      void handleSaveOrder();
                    }
                    if (event.key === "Escape") setShowOrderRef(false);
                  }}
                  rows={3}
                  placeholder="Comentarios de la comanda (sin hielo, llevar, etc.)"
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-400">Al generar se imprimirá la comanda.</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowOrderRef(false)}
                      className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => void handleSaveOrder()}
                      disabled={savingOrder || items.length === 0}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap"
                    >
                      {savingOrder ? "..." : "Guardar Comanda"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (items.length === 0) return;
                  setShowOrderRef(true);
                }}
                disabled={items.length === 0}
                className="w-full flex items-center justify-center gap-2 border-2 border-blue-300 hover:border-blue-500 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed text-blue-700 py-2 rounded-xl text-sm font-medium transition"
              >
                <Save size={15} />
                {activeOrder ? `Actualizar Comanda #${activeOrder.order_number}` : "Generar Comanda"}
              </button>
            )}

            <button
              onClick={() => setShowPayment(true)}
              disabled={items.length === 0}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-4 rounded-xl font-bold text-lg transition"
            >
              Cobrar {loyaltyDiscount > 0 ? formatCLP(effectiveTotal) : "(F4)"}
            </button>
          </div>
        </div>
      </div>

      {showPayment && (
        <PaymentModal
          total={effectiveTotal}
          orderIds={activeOrder ? [activeOrder.id] : undefined}
          onComplete={(sale, showReceipt) => handlePaymentComplete(sale, showReceipt)}
          onClose={() => setShowPayment(false)}
          customerId={selectedCustomer?.id}
          pointsToRedeem={pointsToRedeem}
          loyaltyDiscount={loyaltyDiscount}
        />
      )}

      {showCloseSession && (
        <CloseSessionModal onClose={() => setShowCloseSession(false)} />
      )}

      {lastSale && (
        <ReceiptPreviewModal
          sale={lastSale}
          sellerName={user?.full_name}
          registerName={register?.name}
          onClose={() => setLastSale(null)}
        />
      )}

      {previewOrder && (
        <OrderPreviewModal
          order={previewOrder}
          registerName={register?.name}
          onClose={() => setPreviewOrder(null)}
        />
      )}

      {showOrders && (
        <OrdersModal
          onClose={() => setShowOrders(false)}
          onLoadOrder={handleLoadOrder}
        />
      )}

      {showTableMap && (
        <TableMapModal
          onSelect={(table: TableStatus) => {
            setSelectedTableId(table.id);
            setSelectedTableName(table.name);
            setOrderRef(table.name);
            setShowTableMap(false);
          }}
          onClose={() => setShowTableMap(false)}
        />
      )}
    </div>
  );
}
