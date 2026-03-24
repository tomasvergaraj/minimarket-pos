import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp, Pencil, Check, Star, X } from "lucide-react";
import { useFavoritesStore } from "@/stores/favoritesStore";
import api from "@/services/api";
import type { Product } from "@/types";
import { formatCLP } from "@/utils/format";

const SERVER_URL = localStorage.getItem("server_url") || "http://localhost:8001";

interface Props {
  onProductClick: (product: Product) => void;
}

export default function FavoritesPanel({ onProductClick }: Props) {
  const { slots, setSlot, clearSlot, gridSize, setGridSize } = useFavoritesStore();
  const [editMode, setEditMode] = useState(false);
  const [assigningSlot, setAssigningSlot] = useState<number | null>(null);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignResults, setAssignResults] = useState<Product[]>([]);
  const [showSizeEditor, setShowSizeEditor] = useState(false);
  const [sizeInput, setSizeInput] = useState(String(gridSize));
  const assignInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSizeInput(String(gridSize));
  }, [gridSize]);

  useEffect(() => {
    if (assigningSlot !== null) {
      setTimeout(() => assignInputRef.current?.focus(), 50);
    }
  }, [assigningSlot]);

  const searchForAssign = useCallback(async (q: string) => {
    if (q.length < 2) { setAssignResults([]); return; }
    try {
      const { data } = await api.get("/products/", { params: { search: q } });
      setAssignResults(data.slice(0, 8));
    } catch {}
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchForAssign(assignSearch), 300);
    return () => clearTimeout(t);
  }, [assignSearch, searchForAssign]);

  const handleAssign = (slot: number, product: Product) => {
    setSlot(slot, {
      product_id: product.id,
      product_name: product.name,
      sell_price: product.sell_price,
      image_url: product.image_url ?? null,
    });
    setAssigningSlot(null);
    setAssignSearch("");
    setAssignResults([]);
  };

  const handleSlotClick = async (slot: number) => {
    const fav = slots[slot];
    if (editMode) {
      if (fav) {
        clearSlot(slot);
      } else {
        setAssigningSlot(slot);
        setAssignSearch("");
        setAssignResults([]);
      }
      return;
    }
    if (!fav) return;
    try {
      const { data } = await api.get(`/products/${fav.product_id}`);
      onProductClick(data);
    } catch {
      onProductClick({
        id: fav.product_id,
        sku: "",
        barcode: null,
        name: fav.product_name,
        description: null,
        category: null,
        unit: "un",
        cost_price: 0,
        sell_price: fav.sell_price,
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
        image_url: fav.image_url ?? null,
        created_at: "",
        updated_at: "",
      });
    }
  };

  const handleSizeApply = () => {
    const n = parseInt(sizeInput, 10);
    if (!isNaN(n) && n >= 4) {
      setGridSize(n);
    }
    setShowSizeEditor(false);
  };

  const hasAny = slots.some(Boolean);

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
          <Star size={14} className="text-yellow-500" />
          Favoritos
          <span className="text-xs text-gray-400">({gridSize} slots)</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Size control */}
          {editMode && (
            <button
              onClick={() => setShowSizeEditor((v) => !v)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition"
              title="Cambiar número de slots"
            >
              {showSizeEditor ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              Slots
            </button>
          )}
          <button
            onClick={() => { setEditMode((v) => !v); setAssigningSlot(null); setShowSizeEditor(false); }}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition ${
              editMode
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {editMode ? <><Check size={12} /> Listo</> : <><Pencil size={12} /> Editar</>}
          </button>
        </div>
      </div>

      {/* Size editor */}
      {editMode && showSizeEditor && (
        <div className="mb-2 flex items-center gap-2 bg-gray-50 border rounded-lg px-3 py-2">
          <span className="text-xs text-gray-600">Número de favoritos:</span>
          <input
            type="number"
            min="4"
            max="100"
            value={sizeInput}
            onChange={(e) => setSizeInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSizeApply()}
            className="w-16 text-xs border rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSizeApply}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded transition"
          >
            Aplicar
          </button>
          <span className="text-xs text-gray-400">Mín. 4, máx. 100</span>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: gridSize }, (_, i) => {
          const fav = slots[i] ?? null;
          const isAssigning = assigningSlot === i;

          if (isAssigning) {
            return (
              <div key={i} className="col-span-4 bg-white border-2 border-blue-400 rounded-xl p-2 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">Buscar producto para slot {i + 1}:</p>
                <input
                  ref={assignInputRef}
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setAssigningSlot(null)}
                  placeholder="Nombre o código..."
                  className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                />
                {assignResults.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-y-auto border rounded-lg divide-y bg-white shadow-sm">
                    {assignResults.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleAssign(i, p)}
                        className="w-full text-left px-2 py-1.5 hover:bg-blue-50 transition text-sm"
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className="ml-2 text-gray-400 text-xs">{formatCLP(p.sell_price)}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setAssigningSlot(null)}
                  className="mt-1 text-xs text-gray-400 hover:text-gray-600"
                >
                  Cancelar
                </button>
              </div>
            );
          }

          return (
            <button
              key={i}
              onClick={() => handleSlotClick(i)}
              className={`relative min-h-[64px] rounded-xl border-2 text-left p-2 transition text-sm leading-tight overflow-hidden
                ${fav
                  ? editMode
                    ? "border-red-300 bg-red-50 hover:bg-red-100"
                    : "border-yellow-300 bg-yellow-50 hover:bg-yellow-100 active:scale-95"
                  : editMode
                    ? "border-dashed border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-400"
                    : "border-dashed border-gray-200 bg-gray-50 cursor-default opacity-50"
                }`}
            >
              {fav ? (
                <>
                  {fav.image_url && (
                    <img
                      src={`${SERVER_URL}${fav.image_url}`}
                      alt={fav.product_name}
                      className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
                    />
                  )}
                  {editMode && (
                    <X size={12} className="absolute top-1 right-1 text-red-400 z-10" />
                  )}
                  <p className="relative z-10 font-semibold text-gray-800 text-xs leading-tight line-clamp-2">{fav.product_name}</p>
                  <p className="relative z-10 text-blue-600 font-bold text-xs mt-0.5">{formatCLP(fav.sell_price)}</p>
                </>
              ) : (
                <span className="text-center w-full block text-lg">{editMode ? "+" : ""}</span>
              )}
            </button>
          );
        })}
      </div>

      {!hasAny && !editMode && (
        <p className="text-center text-xs text-gray-400 mt-2">
          Pulsa <strong>Editar</strong> para agregar accesos rápidos
        </p>
      )}
    </div>
  );
}
