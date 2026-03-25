-- Nexo POS — Supabase schema (generado automáticamente)
-- Pega este SQL en: Supabase Dashboard → SQL Editor → New query → Run

CREATE TABLE IF NOT EXISTS cash_registers (
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  branch_id TEXT NOT NULL DEFAULT 'default',
  PRIMARY KEY (id, branch_id)
);

CREATE TABLE IF NOT EXISTS cash_sessions (
  id TEXT NOT NULL,
  register_id TEXT NOT NULL,
  user_id TEXT,
  status TEXT NOT NULL,
  opening_amount NUMERIC(12, 2) NOT NULL,
  closing_amount NUMERIC(12, 2),
  total_cash_sales NUMERIC(12, 2) NOT NULL,
  total_card_sales NUMERIC(12, 2) NOT NULL,
  total_sales_count INTEGER NOT NULL,
  expected_cash NUMERIC(12, 2),
  difference NUMERIC(12, 2),
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  total_transfer_sales NUMERIC(12, 2),
  branch_id TEXT NOT NULL DEFAULT 'default',
  PRIMARY KEY (id, branch_id)
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  branch_id TEXT NOT NULL DEFAULT 'default',
  PRIMARY KEY (id, branch_id)
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  rut TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  points_balance INTEGER NOT NULL DEFAULT 0,
  total_purchases NUMERIC(14, 2) NOT NULL,
  visit_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  branch_id TEXT NOT NULL DEFAULT 'default',
  PRIMARY KEY (id, branch_id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  notes TEXT,
  expense_date DATE NOT NULL,
  created_by_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  branch_id TEXT NOT NULL DEFAULT 'default',
  PRIMARY KEY (id, branch_id)
);

CREATE TABLE IF NOT EXISTS kardex (
  id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  movement_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  stock_before INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  reference_id TEXT,
  notes TEXT,
  user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  branch_id TEXT NOT NULL DEFAULT 'default',
  PRIMARY KEY (id, branch_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  entity_id TEXT,
  entity_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  branch_id TEXT NOT NULL DEFAULT 'default',
  PRIMARY KEY (id, branch_id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL,
  branch_id TEXT NOT NULL DEFAULT 'default',
  PRIMARY KEY (id, branch_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT NOT NULL,
  order_number INTEGER NOT NULL,
  register_id TEXT NOT NULL,
  seller_id TEXT,
  status TEXT NOT NULL,
  reference TEXT,
  notes TEXT,
  sale_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  table_id TEXT,
  bill_requested BOOLEAN NOT NULL DEFAULT false,
  branch_id TEXT NOT NULL DEFAULT 'default',
  PRIMARY KEY (id, branch_id)
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT NOT NULL,
  sku TEXT NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit TEXT NOT NULL,
  cost_price NUMERIC(12, 2) NOT NULL,
  sell_price NUMERIC(12, 2) NOT NULL,
  tax_rate NUMERIC(5, 2) NOT NULL,
  stock INTEGER NOT NULL,
  min_stock INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  pack_size INTEGER NOT NULL DEFAULT 1,
  pack_price NUMERIC(12, 2),
  discount_price NUMERIC(12, 2),
  discount_ends_at TIMESTAMPTZ,
  is_pack BOOLEAN NOT NULL DEFAULT false,
  units_contained INTEGER NOT NULL DEFAULT 1,
  base_product_id TEXT,
  image_url TEXT,
  branch_id TEXT NOT NULL DEFAULT 'default',
  PRIMARY KEY (id, branch_id)
);

CREATE TABLE IF NOT EXISTS promotions (
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  promo_type TEXT NOT NULL,
  product_id TEXT,
  category_name TEXT,
  discount_pct NUMERIC(5, 2),
  discount_amount NUMERIC(12, 2),
  buy_qty INTEGER,
  get_qty INTEGER,
  min_qty INTEGER,
  special_price NUMERIC(12, 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  branch_id TEXT NOT NULL DEFAULT 'default',
  PRIMARY KEY (id, branch_id)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id TEXT NOT NULL,
  purchase_order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity_ordered INTEGER NOT NULL,
  quantity_received INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12, 2) NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL,
  branch_id TEXT NOT NULL DEFAULT 'default',
  PRIMARY KEY (id, branch_id)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT NOT NULL,
  order_number INTEGER NOT NULL,
  supplier_id TEXT NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  subtotal NUMERIC(12, 2) NOT NULL,
  total NUMERIC(12, 2) NOT NULL,
  created_by TEXT,
  confirmed_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  branch_id TEXT NOT NULL DEFAULT 'default',
  PRIMARY KEY (id, branch_id)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT NOT NULL,
  sale_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL,
  tax_rate NUMERIC(5, 2) NOT NULL,
  tax_amount NUMERIC(12, 2) NOT NULL,
  units_per_item INTEGER NOT NULL DEFAULT 1,
  branch_id TEXT NOT NULL DEFAULT 'default',
  PRIMARY KEY (id, branch_id)
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT NOT NULL,
  sale_number INTEGER NOT NULL,
  cash_session_id TEXT NOT NULL,
  register_id TEXT NOT NULL,
  seller_id TEXT,
  subtotal NUMERIC(12, 2) NOT NULL,
  tax_amount NUMERIC(12, 2) NOT NULL,
  total NUMERIC(12, 2) NOT NULL,
  payment_method TEXT NOT NULL,
  cash_amount NUMERIC(12, 2) NOT NULL,
  card_amount NUMERIC(12, 2) NOT NULL,
  change_amount NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL,
  sii_tipo_dte INTEGER,
  sii_folio INTEGER,
  sii_rut_receptor TEXT,
  sii_status TEXT,
  sii_ted_xml TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  transfer_amount NUMERIC(12, 2),
  customer_id TEXT,
  points_earned INTEGER NOT NULL DEFAULT 0,
  points_redeemed INTEGER NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12, 2) NOT NULL,
  branch_id TEXT NOT NULL DEFAULT 'default',
  PRIMARY KEY (id, branch_id)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  rut TEXT,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  branch_id TEXT NOT NULL DEFAULT 'default',
  PRIMARY KEY (id, branch_id)
);

CREATE TABLE IF NOT EXISTS tables (
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4,
  pos_x INTEGER NOT NULL DEFAULT 0,
  pos_y INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  branch_id TEXT NOT NULL DEFAULT 'default',
  PRIMARY KEY (id, branch_id)
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT NOT NULL,
  username TEXT NOT NULL,
  pin TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  is_active BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  branch_id TEXT NOT NULL DEFAULT 'default',
  PRIMARY KEY (id, branch_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cash_registers_branch ON cash_registers(branch_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_created ON cash_registers(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_branch ON cash_sessions(branch_id);
CREATE INDEX IF NOT EXISTS idx_categories_branch ON categories(branch_id);
CREATE INDEX IF NOT EXISTS idx_categories_created ON categories(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_customers_branch ON customers(branch_id);
CREATE INDEX IF NOT EXISTS idx_customers_created ON customers(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_customers_updated ON customers(branch_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_expenses_branch ON expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created ON expenses(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_expenses_updated ON expenses(branch_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_kardex_branch ON kardex(branch_id);
CREATE INDEX IF NOT EXISTS idx_kardex_created ON kardex(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_branch ON notifications(branch_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_branch ON order_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_updated ON orders(branch_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_products_branch ON products(branch_id);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_products_updated ON products(branch_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_promotions_branch ON promotions(branch_id);
CREATE INDEX IF NOT EXISTS idx_promotions_created ON promotions(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_promotions_updated ON promotions(branch_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_branch ON purchase_order_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_branch ON purchase_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created ON purchase_orders(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_updated ON purchase_orders(branch_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_branch ON sale_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_branch ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_suppliers_branch ON suppliers(branch_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_created ON suppliers(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_suppliers_updated ON suppliers(branch_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_tables_branch ON tables(branch_id);
CREATE INDEX IF NOT EXISTS idx_tables_created ON tables(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_users_created ON users(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_users_updated ON users(branch_id, updated_at);

-- Disable RLS (o configura policies según necesites)
ALTER TABLE cash_registers DISABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE kardex DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE promotions DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;