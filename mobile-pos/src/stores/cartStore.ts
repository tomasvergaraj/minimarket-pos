import { create } from 'zustand'
import type { CartItem, Product } from '../types'

export type AddItemResult = 'ok' | 'low_stock' | 'no_stock' | 'exceed_stock'

function effectivePrice(p: Product): number {
  return p.is_on_offer && p.discount_price != null ? p.discount_price : p.sell_price
}

interface CartStore {
  items: CartItem[]
  addItem: (product: Product) => AddItemResult
  removeItem: (productId: string) => void
  updateQty: (productId: string, qty: number) => boolean
  updatePrice: (productId: string, newPrice: number) => void
  clear: () => void
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (product) => {
    const { items } = get()
    const reserved = items.find((i) => i.product.id === product.id)?.quantity ?? 0

    if (product.stock <= 0) return 'no_stock'
    if (reserved + 1 > product.stock) return 'exceed_stock'

    const price = effectivePrice(product)
    const existing = items.find((i) => i.product.id === product.id)
    if (existing) {
      const qty = reserved + 1
      set((state) => ({
        items: state.items.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: qty, subtotal: i.unit_price * qty }
            : i,
        ),
      }))
    } else {
      set((state) => ({
        items: [
          ...state.items,
          { product, quantity: 1, unit_price: price, subtotal: price, tax_amount: 0 },
        ],
      }))
    }

    // Warn if remaining stock after this add is low
    const remaining = product.stock - (reserved + 1)
    const minStock = product.min_stock ?? 0
    if (remaining <= minStock && remaining > 0) return 'low_stock'
    return 'ok'
  },

  removeItem: (productId) =>
    set((state) => ({
      items: state.items.filter((i) => i.product.id !== productId),
    })),

  updateQty: (productId, qty) => {
    const { items } = get()
    if (qty <= 0) {
      set((state) => ({ items: state.items.filter((i) => i.product.id !== productId) }))
      return true
    }
    const item = items.find((i) => i.product.id === productId)
    if (!item) return false
    // Check stock (only for real products, not order-loaded ones with stock=9999)
    if (item.product.stock < 9999 && qty > item.product.stock) return false
    set((state) => ({
      items: state.items.map((i) =>
        i.product.id === productId
          ? { ...i, quantity: qty, subtotal: i.unit_price * qty }
          : i,
      ),
    }))
    return true
  },

  updatePrice: (productId, newPrice) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.product.id === productId
          ? { ...i, unit_price: newPrice, subtotal: newPrice * i.quantity }
          : i,
      ),
    })),

  clear: () => set({ items: [] }),
}))

// Selector functions
export const cartTotal = (s: CartStore) =>
  s.items.reduce((sum, i) => sum + i.subtotal, 0)

export const cartCount = (s: CartStore) =>
  s.items.reduce((sum, i) => sum + i.quantity, 0)
