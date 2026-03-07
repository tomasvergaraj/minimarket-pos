import { create } from "zustand";
import type { Product, CartItem } from "@/types";

/** Effective sell price: uses discount_price if the offer is active */
function effectivePrice(product: Product): number {
  if (product.is_on_offer && product.discount_price && product.discount_price > 0) {
    return product.discount_price;
  }
  return product.sell_price;
}

interface CartState {
  items: CartItem[];
  /** Add product to cart. Returns true if added, false if stock is insufficient. */
  addItem: (product: Product, qty?: number) => boolean;
  removeItem: (cartKey: string) => void;
  /** Returns true if updated, false if quantity would exceed stock. */
  updateQuantity: (cartKey: string, qty: number) => boolean;
  clear: () => void;
  total: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (product, qty = 1) => {
    const cartKey = product.id;
    const unitPrice = effectivePrice(product);
    const items = get().items;

    const reserved = items
      .filter((i) => i.product.id === product.id)
      .reduce((sum, i) => sum + i.quantity, 0);

    if (reserved + qty > product.stock) return false;

    const existing = items.find((i) => i.cartKey === cartKey);
    if (existing) {
      const newQty = existing.quantity + qty;
      set({
        items: items.map((i) =>
          i.cartKey === cartKey
            ? { ...i, quantity: newQty, subtotal: newQty * unitPrice }
            : i
        ),
      });
    } else {
      set({
        items: [
          ...items,
          { cartKey, product, quantity: qty, subtotal: qty * unitPrice, unit_price: unitPrice },
        ],
      });
    }
    return true;
  },

  removeItem: (cartKey) => {
    set({ items: get().items.filter((i) => i.cartKey !== cartKey) });
  },

  updateQuantity: (cartKey, qty) => {
    if (qty <= 0) {
      get().removeItem(cartKey);
      return true;
    }
    const items = get().items;
    const item = items.find((i) => i.cartKey === cartKey);
    if (!item) return false;

    const otherReserved = items
      .filter((i) => i.product.id === item.product.id && i.cartKey !== cartKey)
      .reduce((sum, i) => sum + i.quantity, 0);

    if (otherReserved + qty > item.product.stock) return false;

    set({
      items: items.map((i) =>
        i.cartKey === cartKey
          ? { ...i, quantity: qty, subtotal: qty * i.unit_price }
          : i
      ),
    });
    return true;
  },

  clear: () => set({ items: [] }),

  total: () => get().items.reduce((sum, i) => sum + i.subtotal, 0),

  itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}));
