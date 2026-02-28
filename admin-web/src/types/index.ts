// ── API Response Shapes ──

export interface ApiResponse<T> {
  success: boolean
  data: T
  error: ApiError | null
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  error: ApiError | null
  meta: PaginationMeta
}

export interface ApiError {
  code: string
  message: string
}

export interface PaginationMeta {
  total: number
  skip: number
  limit: number
  has_more: boolean
}

// ── Domain Models ──

export interface User {
  id: string
  username: string
  full_name: string
  role: 'admin' | 'cashier'
  is_active: boolean
  created_at: string
}

export interface UserCreate {
  username: string
  pin: string
  full_name: string
  role: 'admin' | 'cashier'
}

export interface UserUpdate {
  username?: string
  pin?: string
  full_name?: string
  role?: 'admin' | 'cashier'
  is_active?: boolean
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
  created_at: string
  updated_at: string
}

export interface ProductCreate {
  sku: string
  barcode?: string | null
  name: string
  description?: string | null
  category?: string | null
  unit?: string
  cost_price?: number
  sell_price: number
  tax_rate?: number
  stock?: number
  min_stock?: number
}

export interface ProductUpdate {
  sku?: string
  barcode?: string | null
  name?: string
  description?: string | null
  category?: string | null
  unit?: string
  cost_price?: number
  sell_price?: number
  tax_rate?: number
  min_stock?: number
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
  subtotal: number
  tax_amount: number
  total: number
  payment_method: 'cash' | 'card' | 'mixed'
  cash_amount: number
  card_amount: number
  change_amount: number
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
  total_sales_count: number
  expected_cash: number | null
  difference: number | null
  opened_at: string
  closed_at: string | null
}

export interface KardexEntry {
  id: string
  product_id: string
  movement_type: 'sale' | 'restock' | 'adjustment' | 'shrinkage'
  quantity: number
  stock_before: number
  stock_after: number
  reference_id: string | null
  notes: string | null
  user_id: string | null
  created_at: string
}

export interface KardexCreate {
  product_id: string
  movement_type: 'restock' | 'adjustment' | 'shrinkage'
  quantity: number
  notes?: string | null
  user_id?: string | null
}

export interface TopProduct {
  product_id: string
  product_name: string
  quantity_sold: number
  revenue: number
}

export interface DashboardStats {
  ventas_hoy: number
  ingresos_hoy: number
  ticket_promedio: number
  cajas_abiertas: number
  productos_bajo_stock: number
  ventas_anuladas: number
  top_5_productos: TopProduct[]
}

export interface StoreConfig {
  store_name: string
  store_rut: string
  store_address: string
}
