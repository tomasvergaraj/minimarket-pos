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
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  subtotal: number;
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
  change_amount: number;
  status: string;
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
