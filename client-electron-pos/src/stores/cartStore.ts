import { create } from "zustand";
import type { Product, CartItem } from "@/types";

interface CartState {
  items: CartItem[];
  /** Retorna true si se agregó, false si el stock no alcanza */
  addItem: (product: Product, qty?: number) => boolean;
  removeItem: (productId: string) => void;
  /** Retorna true si se actualizó, false si se intentó superar el stock */
  updateQuantity: (productId: string, qty: number) => boolean;
  clear: () => void;
  total: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (product, qty = 1) => {
    const items = get().items;
    const existing = items.find((i) => i.product.id === product.id);
    const currentQty = existing ? existing.quantity : 0;
    const newQty = currentQty + qty;

    if (newQty > product.stock) return false;

    if (existing) {
      set({
        items: items.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: newQty, subtotal: newQty * product.sell_price }
            : i
        ),
      });
    } else {
      set({
        items: [...items, { product, quantity: qty, subtotal: qty * product.sell_price }],
      });
    }
    return true;
  },

  removeItem: (productId) => {
    set({ items: get().items.filter((i) => i.product.id !== productId) });
  },

  updateQuantity: (productId, qty) => {
    if (qty <= 0) {
      get().removeItem(productId);
      return true;
    }
    const item = get().items.find((i) => i.product.id === productId);
    if (item && qty > item.product.stock) return false;

    set({
      items: get().items.map((i) =>
        i.product.id === productId
          ? { ...i, quantity: qty, subtotal: qty * i.product.sell_price }
          : i
      ),
    });
    return true;
  },

  clear: () => set({ items: [] }),

  total: () => get().items.reduce((sum, i) => sum + i.subtotal, 0),

  itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}));
