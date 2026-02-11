import { useState, useRef, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useCartStore } from "@/stores/cartStore";
import { formatCLP } from "@/utils/format";
import api from "@/services/api";
import toast from "react-hot-toast";
import type { Product, Sale } from "@/types";
import PaymentModal from "@/components/PaymentModal";
import CloseSessionModal from "@/components/CloseSessionModal";
import ReceiptView from "@/components/ReceiptView";
import { Search, Trash2, Plus, Minus, LogOut, X, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

  // Barcode scanner: auto-search on input
  const handleSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }
    try {
      // Only try barcode lookup if input is numeric (barcode scanner)
      if (/^\d+$/.test(trimmed)) {
        try {
          const { data } = await api.get(`/products/barcode/${trimmed}`);
          addItem(data);
          setSearchQuery("");
          setSearchResults([]);
          toast.success(`${data.name} agregado`);
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
  }, [addItem]);

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

  // Handle barcode scanner (Enter = submit barcode)
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
              {searchResults.map((product) => (
                <button
                  key={product.id}
                  onClick={() => {
                    addItem(product);
                    setSearchQuery("");
                    setSearchResults([]);
                    toast.success(`${product.name} agregado`);
                    searchRef.current?.focus();
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 border-b last:border-0 transition"
                >
                  <div className="text-left">
                    <p className="font-medium text-gray-800">{product.name}</p>
                    <p className="text-sm text-gray-500">
                      {product.sku} {product.barcode && `| ${product.barcode}`} | Stock: {product.stock}
                    </p>
                  </div>
                  <span className="font-bold text-blue-600 text-lg">{formatCLP(product.sell_price)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Last sale receipt */}
          {lastSale && (
            <div className="flex-1 overflow-auto">
              <ReceiptView sale={lastSale} onClose={() => setLastSale(null)} />
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
                {items.map((item) => (
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
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">{formatCLP(item.product.sell_price)} c/u</p>
                        <p className="font-bold text-gray-800">{formatCLP(item.subtotal)}</p>
                      </div>
                    </div>
                  </div>
                ))}
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
    </div>
  );
}
