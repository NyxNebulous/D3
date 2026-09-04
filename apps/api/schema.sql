-- D3 Restaurant Production Database Schema for Cloudflare D1
-- Run with: npx wrangler d1 execute D3_DB --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS dining_tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS table_qr_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qr_identifier TEXT NOT NULL UNIQUE,
  dining_table_id INTEGER NOT NULL REFERENCES dining_tables(id),
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_table_qr_codes_table ON table_qr_codes(dining_table_id);

CREATE TABLE IF NOT EXISTS pre_verification_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  dining_table_id INTEGER NOT NULL REFERENCES dining_tables(id),
  table_qr_code_id INTEGER NOT NULL REFERENCES table_qr_codes(id),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pre_verification_sessions_hash ON pre_verification_sessions(token_hash);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  mobile_number TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  dining_table_id INTEGER NOT NULL REFERENCES dining_tables(id),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_hash ON customer_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer ON customer_sessions(customer_id);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id TEXT PRIMARY KEY,
  pre_session_id INTEGER NOT NULL REFERENCES pre_verification_sessions(id),
  name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  staff_user_id INTEGER NOT NULL REFERENCES staff_users(id),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_sessions_hash ON staff_sessions(token_hash);

CREATE TABLE IF NOT EXISTS menu_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES menu_categories(id),
  name TEXT NOT NULL,
  price_paise INTEGER NOT NULL CHECK (price_paise > 0),
  is_veg INTEGER NOT NULL DEFAULT 1 CHECK (is_veg IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(category_id, name)
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);

CREATE TABLE IF NOT EXISTS carts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_session_id INTEGER NOT NULL UNIQUE REFERENCES customer_sessions(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cart_items (
  cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 99),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (cart_id, menu_item_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_order_number TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  customer_session_id INTEGER NOT NULL REFERENCES customer_sessions(id),
  dining_table_id INTEGER NOT NULL REFERENCES dining_tables(id),
  total_paise INTEGER NOT NULL CHECK (total_paise >= 0),
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  payment_state TEXT NOT NULL DEFAULT 'UNPAID' CHECK (payment_state IN ('UNPAID', 'PAID_OFFLINE')),
  fulfillment_state TEXT NOT NULL DEFAULT 'PENDING' CHECK (fulfillment_state IN ('PENDING', 'COMPLETED')),
  paid_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(customer_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(dining_table_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER REFERENCES menu_items(id),
  item_name TEXT NOT NULL,
  is_veg INTEGER NOT NULL DEFAULT 1 CHECK (is_veg IN (0, 1)),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise > 0),
  line_total_paise INTEGER NOT NULL CHECK (line_total_paise > 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS order_state_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT NOT NULL,
  staff_user_id INTEGER REFERENCES staff_users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_state_events_order ON order_state_events(order_id);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  order_id INTEGER REFERENCES orders(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(scope, idempotency_key)
);

-- Initial Staff Admin (username: admin, password: manager-password)
INSERT OR IGNORE INTO staff_users (id, username, password_hash)
VALUES (1, 'admin', 'sha256$1d21b5958fd00f5c6f2d0fd630b8fb23$74d29bbcd98ebedbbaeb7c35890c1514f8c2e26ffe0167e342a8c048ea889137');

-- Initial Tables 1 to 10
INSERT OR IGNORE INTO dining_tables (id, label) VALUES
  (1, 'Table 1'),
  (2, 'Table 2'),
  (3, 'Table 3'),
  (4, 'Table 4'),
  (5, 'Table 5'),
  (6, 'Table 6'),
  (7, 'Table 7'),
  (8, 'Table 8'),
  (9, 'Table 9'),
  (10, 'Table 10');

-- QR identifiers for Tables 1 to 10
INSERT OR IGNORE INTO table_qr_codes (id, qr_identifier, dining_table_id) VALUES
  (1, 'qr-table-1', 1),
  (2, 'qr-table-2', 2),
  (3, 'qr-table-3', 3),
  (4, 'qr-table-4', 4),
  (5, 'qr-table-5', 5),
  (6, 'qr-table-6', 6),
  (7, 'qr-table-7', 7),
  (8, 'qr-table-8', 8),
  (9, 'qr-table-9', 9),
  (10, 'qr-table-10', 10);

-- Initial Starter Menu
INSERT OR IGNORE INTO menu_categories (id, name, sort_order) VALUES
  (1, 'Mains', 1),
  (2, 'Starters', 2),
  (3, 'Beverages', 3);

INSERT OR IGNORE INTO menu_items (id, category_id, name, price_paise, is_veg, sort_order) VALUES
  (1, 1, 'Paneer Butter Masala', 24000, 1, 1),
  (2, 1, 'Dal Makhani', 19000, 1, 2),
  (3, 2, 'Crispy Corn', 15000, 1, 1),
  (4, 3, 'Fresh Lime Soda', 8000, 1, 1);
