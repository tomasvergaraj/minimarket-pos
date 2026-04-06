export interface PaginationMeta {
  total: number
  skip: number
  limit: number
  has_more: boolean
}

export interface User {
  id: string
  username: string
  full_name: string
  role: 'admin' | 'cashier'
  is_active: boolean
  created_at: string
}

export interface AuthSession {
  access_token: string
  refresh_token: string
  token_type: 'bearer'
  expires_in: number
  user: User
}

export interface StoredSession extends AuthSession {
  expires_at: string
}

export interface Product {
  id: string
  sku: string
  barcode: string | null
  name: string
  description: string | null
  category: string | null
  unit: string
  cost_price: number
  sell_price: number
  tax_rate: number
  stock: number
  min_stock: number
  is_active: boolean
  is_pack: boolean
  units_contained: number
  base_product_id: string | null
  discount_price: number | null
  discount_ends_at: string | null
  is_on_offer: boolean
  image_url: string | null
  created_at: string
  updated_at: string
}

export interface ProductUpdate {
  sell_price?: number
  stock?: number
  min_stock?: number
  is_active?: boolean
}

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
  seller_id: string | null
  customer_id: string | null
  customer_name: string | null
  subtotal: number
  tax_amount: number
  discount_amount: number
  total: number
  payment_method: 'cash' | 'card' | 'transfer' | 'mixed'
  cash_amount: number
  card_amount: number
  transfer_amount: number
  change_amount: number
  points_earned: number
  points_redeemed: number
  status: 'completed' | 'voided'
  created_at: string
  items: SaleItem[]
}

export interface CashRegister {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

export interface CashSession {
  id: string
  register_id: string
  user_id: string | null
  status: 'open' | 'closed'
  opening_amount: number
  closing_amount: number | null
  total_cash_sales: number
  total_card_sales: number
  total_transfer_sales: number
  total_sales_count: number
  expected_cash: number | null
  difference: number | null
  opened_at: string
  closed_at: string | null
}

// ── Customer & Loyalty ──

export interface Customer {
  id: string
  name: string
  rut: string | null
  phone: string | null
  email: string | null
  notes: string | null
  points_balance: number
  total_purchases: number
  visit_count: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LoyaltyConfig {
  points_per_thousand: number
  point_value: number
}

// ── Kardex / Stock ──

export interface KardexCreate {
  product_id: string
  movement_type: 'restock' | 'adjustment' | 'shrinkage'
  quantity: number
  notes?: string | null
}

// ── Store Config ──

export interface StoreConfig {
  store_name: string
  store_rut: string | null
  store_address: string | null
  business_type: string
}

// ── Favorites ──

export interface FavoriteSlot {
  slot: number
  product_id: string
  product_name: string
  sell_price: number
}

// ── POS-specific ──

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'mixed'

export interface CartItem {
  product: Product
  quantity: number
  unit_price: number
  discount_pct: number
}

export interface SaleCreate {
  cash_session_id: string
  register_id: string
  items: { product_id: string; quantity: number; unit_price_override?: number }[]
  payment_method: PaymentMethod
  cash_amount: number
  card_amount: number
  transfer_amount: number
  customer_id?: string
  points_to_redeem?: number
  emit_receipt?: boolean
}

export interface OpenSessionInput {
  register_id: string
  opening_amount: number
}

export interface CloseSessionInput {
  closing_amount: number
  notes?: string
}

// ── Comandas ──

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
  items: { product_id: string; quantity: number }[]
}

export interface OrderPatch {
  items?: { product_id: string; quantity: number }[]
  reference?: string | null
  notes?: string | null
}

// ── Print preferences ──

export interface PrintPrefs {
  auto_print: boolean
  store_name: string
}
