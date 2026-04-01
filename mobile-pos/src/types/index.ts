// ── Usuarios ──────────────────────────────────────────────────────────────────

export interface User {
  id: string
  username: string
  full_name: string
  role: 'admin' | 'cashier'
  is_active: boolean
}

export interface AuthSession {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  expires_at?: string
  user: User
}

// ── Productos ─────────────────────────────────────────────────────────────────

export interface Product {
  id: string
  sku: string
  barcode?: string | null
  name: string
  description?: string | null
  category?: string | null
  sell_price: number
  cost_price: number
  tax_rate: number
  stock: number
  min_stock?: number | null
  image_url?: string | null
  is_pack: boolean
  units_contained: number
  base_product_id?: string | null
  discount_price?: number | null
  discount_ends_at?: string | null
  is_on_offer?: boolean
  is_active: boolean
  created_at?: string
  updated_at?: string
}

// ── Carrito ───────────────────────────────────────────────────────────────────

export interface CartItem {
  product: Product
  quantity: number
  unit_price: number   // precio efectivo (descuento si aplica)
  subtotal: number     // unit_price * quantity
  tax_amount: number   // IVA incluido en subtotal
}

// ── Caja ──────────────────────────────────────────────────────────────────────

export interface CashRegister {
  id: string
  name: string
  is_active: boolean
}

export interface CashSession {
  id: string
  register_id: string
  user_id: string
  status: 'open' | 'closed'
  opening_amount: number
  closing_amount?: number | null
  total_cash_sales: number
  total_card_sales: number
  total_transfer_sales: number
  total_sales_count: number
  opened_at: string
  closed_at?: string | null
}

// ── Ventas ────────────────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'mixed'
export type SaleStatus = 'completed' | 'voided'

export interface SaleItem {
  id: string
  product_id: string
  product_name: string
  product_sku: string
  quantity: number
  unit_price: number
  subtotal: number
  tax_rate: number
  tax_amount: number
}

export interface Sale {
  id: string
  sale_number: number
  cash_session_id: string
  register_id: string
  seller_id?: string | null
  subtotal: number
  tax_amount: number
  total: number
  payment_method: PaymentMethod
  cash_amount: number
  card_amount: number
  transfer_amount: number
  change_amount: number
  status: SaleStatus
  customer_id?: string | null
  points_earned: number
  points_redeemed: number
  discount_amount: number
  items: SaleItem[]
  created_at: string
}

export interface SaleCreate {
  cash_session_id: string
  register_id: string
  seller_id?: string
  items: {
    product_id: string
    quantity: number
    unit_price_override?: number
  }[]
  payment_method: PaymentMethod
  cash_amount: number
  card_amount: number
  transfer_amount: number
  customer_id?: string
  points_to_redeem?: number
  order_ids?: string[]
}

// ── Clientes ──────────────────────────────────────────────────────────────────

export interface Customer {
  id: string
  name: string
  rut?: string | null
  phone?: string | null
  email?: string | null
  points_balance: number
  total_purchases: number
  visit_count: number
  is_active: boolean
}

// ── API Responses ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data: T
  error: string | null
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  meta: {
    total: number
    skip: number
    limit: number
    has_more: boolean
  }
  error: string | null
}

// ── Favoritos ─────────────────────────────────────────────────────────────────
export interface FavoriteSlot {
  slot: number
  product_id: string
  product_name: string
  sell_price: number
}

// ── Comandas ──────────────────────────────────────────────────────────────────
export interface OrderItemOut {
  id: string
  product_id: string
  product_name: string
  product_sku: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface Order {
  id: string
  order_number: number
  register_id: string
  seller_id?: string | null
  status: string
  reference?: string | null
  notes?: string | null
  sale_id?: string | null
  bill_requested: boolean
  kitchen_ready: boolean
  created_at: string
  updated_at: string
  items: OrderItemOut[]
}

export interface OrderCreate {
  register_id: string
  reference?: string
  notes?: string
  table_id?: string
  items: { product_id: string; quantity: number }[]
}
