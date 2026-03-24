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

export interface AuthSession {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  user: User
}

export interface StoredAdminSession extends AuthSession {
  expires_at: string
}

export interface LicenseStatus {
  status: string
  message: string
  is_active: boolean
  verification_ready: boolean
  installation_id: string
  hardware_hash: string
  request_code: string
  request_payload_json: string
  trial_started_at: string | null
  trial_expires_at: string | null
  trial_days_remaining: number | null
  activated_at: string | null
  license_id: string | null
  customer_name: string | null
  license_type: string | null
  license_expires_at: string | null
  updates_until: string | null
  max_registers: number | null
  features: string[]
  register_count: number
  last_validation_error: string | null
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
  // Pack / presentación
  is_pack: boolean
  units_contained: number
  base_product_id: string | null
  // Oferta
  discount_price: number | null
  discount_ends_at: string | null
  is_on_offer: boolean
  // Imagen
  image_url: string | null
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
  is_pack?: boolean
  units_contained?: number
  base_product_id?: string | null
  discount_price?: number | null
  discount_ends_at?: string | null
  image_url?: string | null
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
  is_pack?: boolean
  units_contained?: number
  base_product_id?: string | null
  discount_price?: number | null
  discount_ends_at?: string | null
  image_url?: string | null
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
  payment_method: 'cash' | 'card' | 'transfer' | 'mixed'
  cash_amount: number
  card_amount: number
  transfer_amount: number
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
  total_transfer_sales: number
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

// ── Suppliers ──

export interface Supplier {
  id: string
  name: string
  rut: string | null
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SupplierCreate {
  name: string
  rut?: string | null
  contact_name?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
}

export interface SupplierUpdate {
  name?: string
  rut?: string | null
  contact_name?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  is_active?: boolean
}

// ── Purchase Orders ──

export type PurchaseOrderStatus = 'draft' | 'confirmed' | 'received'

export interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  product_id: string
  product_name: string | null
  product_sku: string | null
  quantity_ordered: number
  quantity_received: number
  unit_cost: number
  subtotal: number
}

export interface PurchaseOrder {
  id: string
  order_number: number
  supplier_id: string
  supplier_name: string | null
  status: PurchaseOrderStatus
  notes: string | null
  subtotal: number
  total: number
  created_by: string | null
  confirmed_at: string | null
  received_at: string | null
  created_at: string
  updated_at: string
  items: PurchaseOrderItem[]
}

export interface PurchaseOrderItemCreate {
  product_id: string
  quantity_ordered: number
  unit_cost: number
}

export interface PurchaseOrderCreate {
  supplier_id: string
  notes?: string | null
  items: PurchaseOrderItemCreate[]
}

export interface PurchaseOrderUpdate {
  notes?: string | null
  items?: PurchaseOrderItemCreate[]
}

export interface ReceiveItemInput {
  item_id: string
  quantity_received: number
}

export interface ReceivePurchaseOrderInput {
  items: ReceiveItemInput[]
}
