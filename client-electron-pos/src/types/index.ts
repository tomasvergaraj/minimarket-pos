export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  cost_price: number;
  sell_price: number;
  tax_rate: number;
  stock: number;
  min_stock: number;
  is_active: boolean;
  // Pack / presentación (stock viene de base_product, ya computado por API)
  is_pack: boolean;
  units_contained: number;
  base_product_id: string | null;
  // Oferta
  discount_price: number | null;
  discount_ends_at: string | null;
  is_on_offer: boolean;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  cartKey: string;        // product.id
  product: Product;
  quantity: number;
  subtotal: number;
  unit_price: number;     // effective price per item (sell or discount)
}

export interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  units_per_item: number;
}

export interface Sale {
  id: string;
  sale_number: number;
  cash_session_id: string;
  register_id: string;
  seller_id: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  payment_method: string;
  cash_amount: number;
  card_amount: number;
  transfer_amount: number;
  change_amount: number;
  status: string;
  // SII Boleta Electrónica
  sii_tipo_dte: number | null;
  sii_folio: number | null;
  sii_rut_receptor: string | null;
  sii_status: string | null;
  sii_ted_xml: string | null;
  created_at: string;
  items: SaleItem[];
}

export interface CashRegister {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface CashSession {
  id: string;
  register_id: string;
  user_id: string | null;
  status: string;
  opening_amount: number;
  closing_amount: number | null;
  total_cash_sales: number;
  total_card_sales: number;
  total_sales_count: number;
  expected_cash: number | null;
  difference: number | null;
  opened_at: string;
  closed_at: string | null;
}

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthSession {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: User;
}

export interface LicenseStatus {
  status: string;
  message: string;
  is_active: boolean;
  verification_ready: boolean;
  installation_id: string;
  hardware_hash: string;
  request_code: string;
  request_payload_json: string;
  trial_started_at: string | null;
  trial_expires_at: string | null;
  trial_days_remaining: number | null;
  activated_at: string | null;
  license_id: string | null;
  customer_name: string | null;
  license_type: string | null;
  license_expires_at: string | null;
  updates_until: string | null;
  max_registers: number | null;
  features: string[];
  register_count: number;
  last_validation_error: string | null;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Order {
  id: string;
  order_number: number;
  register_id: string;
  seller_id: string | null;
  status: "open" | "closed" | "cancelled";
  reference: string | null;
  notes: string | null;
  sale_id: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

export interface FavoriteSlot {
  slot: number;
  product_id: string;
  product_name: string;
  sell_price: number;
}
