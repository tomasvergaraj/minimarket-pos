import { useState, useCallback, useEffect } from "react";
import { Grid2X2, Loader2 } from "lucide-react";
import api from "@/services/api";
import type { CartItem, Product } from "@/types";
import { formatCLP } from "@/utils/format";

interface Category {
  id: string;
  name: string;
  color: string | null;
}

interface Props {
  onProductClick: (product: Product) => void;
  cartItems: CartItem[];
}

const SERVER_URL = localStorage.getItem("server_url") || "http://localhost:8001";

export default function CategoryGrid({ onProductClick, cartItems }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingProds, setLoadingProds] = useState(false);

  useEffect(() => {
    api
      .get("/categories/")
      .then(({ data }) => {
        const cats: Category[] = Array.isArray(data) ? data : (data.data ?? []);
        setCategories(cats);
      })
      .catch(() => {})
      .finally(() => setLoadingCats(false));
  }, []);

  const handleSelectCategory = useCallback(
    async (name: string) => {
      if (name === selectedCategory) {
        setSelectedCategory(null);
        setProducts([]);
        return;
      }
      setSelectedCategory(name);
      setLoadingProds(true);
      try {
        const { data } = await api.get("/products/", {
          params: { category: name, limit: 120 },
        });
        setProducts(Array.isArray(data) ? data : (data.data ?? []));
      } catch {
        setProducts([]);
      } finally {
        setLoadingProds(false);
      }
    },
    [selectedCategory]
  );

  if (loadingCats || !categories.length) return null;

  const activeCategoryColor =
    categories.find((c) => c.name === selectedCategory)?.color ?? "#6366f1";

  return (
    <div className="mb-4">
      {/* Category pill tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
        <Grid2X2 size={13} className="text-gray-400 shrink-0" />
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.name;
          const color = cat.color ?? "#6366f1";
          return (
            <button
              key={cat.id}
              onClick={() => void handleSelectCategory(cat.name)}
              style={
                isActive
                  ? { backgroundColor: color, borderColor: color, color: "#fff" }
                  : { borderColor: color, color: color }
              }
              className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border-2 transition active:scale-95 whitespace-nowrap ${
                isActive ? "shadow-sm" : "bg-white hover:opacity-75"
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Product grid */}
      {selectedCategory && (
        <div className="mt-3">
          {loadingProds ? (
            <div className="flex justify-center py-8">
              <Loader2 size={22} className="animate-spin text-gray-300" />
            </div>
          ) : products.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-6">
              No hay productos en esta categoría
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-[380px] overflow-y-auto pr-1">
              {products.map((product) => {
                const reserved = cartItems
                  .filter((ci) => ci.product.id === product.id)
                  .reduce((sum, ci) => sum + ci.quantity, 0);
                const remaining = product.stock - reserved;
                const outOfStock = remaining <= 0;
                const displayPrice =
                  product.is_on_offer && product.discount_price
                    ? product.discount_price
                    : product.sell_price;

                return (
                  <button
                    key={product.id}
                    onClick={() => {
                      if (!outOfStock) onProductClick(product);
                    }}
                    disabled={outOfStock}
                    className={`relative rounded-xl border-2 text-left transition overflow-hidden flex flex-col ${
                      outOfStock
                        ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                        : "border-gray-200 bg-white hover:border-blue-400 hover:shadow-md active:scale-95 cursor-pointer"
                    }`}
                  >
                    {/* Image / initial placeholder */}
                    <div className="w-full aspect-square overflow-hidden shrink-0">
                      {product.image_url ? (
                        <img
                          src={`${SERVER_URL}${product.image_url}`}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-2xl font-bold select-none"
                          style={{
                            backgroundColor: `${activeCategoryColor}20`,
                            color: activeCategoryColor,
                          }}
                        >
                          {product.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Offer badge */}
                    {product.is_on_offer && (
                      <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                        OFERTA
                      </span>
                    )}
                    {product.is_pack && (
                      <span className="absolute top-1 left-1 bg-purple-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                        x{product.units_contained}
                      </span>
                    )}

                    {/* Out-of-stock overlay */}
                    {outOfStock && (
                      <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
                        <span className="text-xs text-red-600 font-bold">Sin stock</span>
                      </div>
                    )}

                    {/* Name & price */}
                    <div className="p-2 flex-1">
                      <p className="text-[11px] font-semibold text-gray-800 leading-tight line-clamp-2">
                        {product.name}
                      </p>
                      {product.is_on_offer && product.discount_price ? (
                        <div className="mt-0.5">
                          <p className="text-[10px] text-gray-400 line-through leading-none">
                            {formatCLP(product.sell_price)}
                          </p>
                          <p className="text-sm font-bold text-red-600 leading-tight">
                            {formatCLP(product.discount_price)}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm font-bold text-blue-600 mt-0.5 leading-tight">
                          {formatCLP(displayPrice)}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
