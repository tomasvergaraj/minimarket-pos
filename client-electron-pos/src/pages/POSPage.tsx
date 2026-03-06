import { useState, useRef, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useCartStore } from "@/stores/cartStore";
import { formatCLP } from "@/utils/format";
import api from "@/services/api";
import toast from "react-hot-toast";
import type { Product, Sale } from "@/types";
import PaymentModal from "@/components/PaymentModal";
import CloseSessionModal from "@/components/CloseSessionModal";
import ReceiptPreviewModal from "@/components/ReceiptPreviewModal";
import { Search, Trash2, Plus, Minus, LogOut, X, Settings, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

/** Devuelve clase de color según stock disponible vs mínimo */
function stockColor(stock: number, minStock: number) {
  if (stock <= 0) return "text-red-600 font-semibold";
  if (stock <= minStock) return "text-yellow-600 font-semibold";
  return "text-green-600";
}

/** Badge de stock para el carrito: muestra unidades restantes tras restar lo del carrito */
function StockBadge({ remaining, minStock }: { remaining: number; minStock: number }) {
  if (remaining > minStock) return null; // suficiente stock, no molesta
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

export default function POSPage() {
  const { user, register, session } = useAuthStore();
  const { items, addItem, removeItem, updateQuantity, clear, total } = useCartStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [showCloseSession, setShowCloseSession] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const tryAddItem = useCallback((product: Product) => {
    if (product.stock <= 0) {
      toast.error(`${product.name}: sin stock`);
      return;
    }
    const ok = addItem(product);
    if (!ok) {
      const inCart = items.find((i) => i.product.id === product.id)?.quantity ?? 0;
      toast.error(`Stock insuficiente — máx. ${product.stock} (${inCart} en carrito)`);
    } else {
      toast.success(`${product.name} agregado`);
    }
  }, [addItem, items]);

  // Barcode scanner: auto-search on input
  const handleSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }
    try {
      if (/^\d+$/.test(trimmed)) {
        try {
          const { data } = await api.get(`/products/barcode/${trimmed}`);
          tryAddItem(data);
          setSearchQuery("");
          setSearchResults([]);
          return;
        } catch {
          // Not a valid barcode, fall through to name search
        }
      }
      const { data } = await api.get("/products/", { params: { search: trimmed } });
      setSearchResults(data);
    } catch {
      toast.error("Error buscando productos");
    }
  }, [tryAddItem]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        handleSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // Keyboard shortcut: focus search on F2
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "F4") {
        e.preventDefault();
        if (items.length > 0) setShowPayment(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [items]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch(searchQuery);
    }
  };

  const handlePaymentComplete = (sale: Sale) => {
    setLastSale(sale);
    clear();
    setShowPayment(false);
    toast.success(`Venta #${sale.sale_number} completada`);
    searchRef.current?.focus();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-lg text-blue-600">MiniMarket POS</h1>
          <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
            {register?.name}
          </span>
          <span className="text-sm text-gray-500">{user?.full_name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/settings")} className="p-2 text-gray-400 hover:text-gray-600">
            <Settings size={20} />
          </button>
          <button
            onClick={() => setShowCloseSession(true)}
            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <LogOut size={16} />
            Cerrar Caja
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Search + Products */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          {/* Search bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm mb-4 max-h-64 overflow-y-auto">
              {searchResults.map((product) => {
                const inCart = items.find((i) => i.product.id === product.id)?.quantity ?? 0;
                const remaining = product.stock - inCart;
                const outOfStock = remaining <= 0;
                return (
                  <button
                    key={product.id}
                    onClick={() => {
                      tryAddItem(product);
                      setSearchQuery("");
                      setSearchResults([]);
                      searchRef.current?.focus();
                    }}
                    disabled={outOfStock}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed border-b last:border-0 transition"
                  >
                    <div className="text-left">
                      <p className="font-medium text-gray-800">{product.name}</p>
                      <p className="text-sm text-gray-500">
                        {product.sku} {product.barcode && `| ${product.barcode}`}
                        {" | "}
                        <span className={stockColor(remaining, product.min_stock)}>
                          Stock: {product.stock}
                          {inCart > 0 && ` (${inCart} en carrito)`}
                        </span>
                      </p>
                    </div>
                    <span className="font-bold text-blue-600 text-lg">{formatCLP(product.sell_price)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Cart */}
        <div className="w-[420px] bg-white border-l flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800 text-lg">Carrito</h2>
              {items.length > 0 && (
                <button onClick={clear} className="text-red-500 hover:text-red-600 text-sm flex items-center gap-1">
                  <Trash2 size={14} /> Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p>Escanee o busque productos</p>
              </div>
            ) : (
              <div className="divide-y">
                {items.map((item) => {
                  const remaining = item.product.stock - item.quantity;
                  const atLimit = item.quantity >= item.product.stock;
                  return (
                    <div key={item.product.id} className="p-3 hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-medium text-gray-800 text-sm flex-1 pr-2">{item.product.name}</p>
                        <button onClick={() => removeItem(item.product.id)} className="text-red-400 hover:text-red-600 shrink-0">
                          <X size={16} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-10 text-center font-mono font-bold">{item.quantity}</span>
                          <button
                            onClick={() => {
                              const ok = updateQuantity(item.product.id, item.quantity + 1);
                              if (!ok) toast.error(`Stock máximo: ${item.product.stock}`);
                            }}
                            disabled={atLimit}
                            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">{formatCLP(item.product.sell_price)} c/u</p>
                          <p className="font-bold text-gray-800">{formatCLP(item.subtotal)}</p>
                        </div>
                      </div>
                      {/* Stock indicator */}
                      <div className="mt-1">
                        <StockBadge remaining={remaining} minStock={item.product.min_stock} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart footer */}
          <div className="border-t p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total</span>
              <span className="text-3xl font-bold text-gray-800">{formatCLP(total())}</span>
            </div>
            <button
              onClick={() => setShowPayment(true)}
              disabled={items.length === 0}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-4 rounded-xl font-bold text-lg transition"
            >
              Cobrar (F4)
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showPayment && (
        <PaymentModal
          total={total()}
          onComplete={handlePaymentComplete}
          onClose={() => setShowPayment(false)}
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
    </div>
  );
}
