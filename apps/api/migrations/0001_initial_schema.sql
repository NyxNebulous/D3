-- D3 Restaurant System: Initial Schema for PostgreSQL

-- Compatibility helper functions for datetime() expressions
CREATE OR REPLACE FUNCTION datetime(t text) RETURNS timestamptz AS $$
BEGIN
  IF t = 'now' THEN
    RETURN clock_timestamp();
  ELSE
    RETURN t::timestamptz;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION datetime(t timestamptz) RETURNS timestamptz AS $$
BEGIN
  RETURN t;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION datetime(t text, modifier text) RETURNS timestamptz AS $$
BEGIN
  IF t = 'now' THEN
    RETURN clock_timestamp() + modifier::interval;
  ELSE
    RETURN t::timestamptz + modifier::interval;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION datetime(t timestamptz, modifier text) RETURNS timestamptz AS $$
BEGIN
  RETURN t + modifier::interval;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1. Dining Tables
CREATE TABLE IF NOT EXISTS dining_tables (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table QR Codes
CREATE TABLE IF NOT EXISTS table_qr_codes (
  id SERIAL PRIMARY KEY,
  qr_identifier TEXT NOT NULL UNIQUE,
  dining_table_id INTEGER NOT NULL REFERENCES dining_tables(id),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_table_qr_codes_table ON table_qr_codes(dining_table_id);

-- 3. Pre-Verification Sessions
CREATE TABLE IF NOT EXISTS pre_verification_sessions (
  id SERIAL PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  dining_table_id INTEGER NOT NULL REFERENCES dining_tables(id),
  table_qr_code_id INTEGER NOT NULL REFERENCES table_qr_codes(id),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pre_verification_sessions_hash ON pre_verification_sessions(token_hash);

-- 4. Customers
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  mobile_number TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Customer Sessions
CREATE TABLE IF NOT EXISTS customer_sessions (
  id SERIAL PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  dining_table_id INTEGER NOT NULL REFERENCES dining_tables(id),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_hash ON customer_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer ON customer_sessions(customer_id);

-- 6. OTP Challenges
CREATE TABLE IF NOT EXISTS otp_challenges (
  id TEXT PRIMARY KEY,
  pre_session_id INTEGER NOT NULL REFERENCES pre_verification_sessions(id),
  name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_pre_session ON otp_challenges(pre_session_id);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_mobile ON otp_challenges(mobile_number);

-- 7. Staff Users
CREATE TABLE IF NOT EXISTS staff_users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Staff Sessions
CREATE TABLE IF NOT EXISTS staff_sessions (
  id SERIAL PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  staff_user_id INTEGER NOT NULL REFERENCES staff_users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_sessions_hash ON staff_sessions(token_hash);

-- 9. Menu Categories
CREATE TABLE IF NOT EXISTS menu_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES menu_categories(id),
  name TEXT NOT NULL,
  price_paise INTEGER NOT NULL CHECK (price_paise > 0),
  is_veg INTEGER NOT NULL DEFAULT 1 CHECK (is_veg IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(category_id, name)
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);

-- 11. Carts
CREATE TABLE IF NOT EXISTS carts (
  id SERIAL PRIMARY KEY,
  customer_session_id INTEGER NOT NULL UNIQUE REFERENCES customer_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. Cart Items
CREATE TABLE IF NOT EXISTS cart_items (
  cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 99),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (cart_id, menu_item_id)
);

-- 13. Orders
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  public_order_number TEXT NOT NULL UNIQUE,
  customer_id INTEGER REFERENCES customers(id),
  customer_session_id INTEGER REFERENCES customer_sessions(id),
  dining_table_id INTEGER NOT NULL REFERENCES dining_tables(id),
  total_paise INTEGER NOT NULL CHECK (total_paise >= 0),
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  payment_state TEXT NOT NULL DEFAULT 'UNPAID' CHECK (payment_state IN ('UNPAID', 'PAID_OFFLINE')),
  fulfillment_state TEXT NOT NULL DEFAULT 'PENDING' CHECK (fulfillment_state IN ('PENDING', 'COMPLETED')),
  paid_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(customer_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(dining_table_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- 14. Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER REFERENCES menu_items(id),
  item_name TEXT NOT NULL,
  is_veg INTEGER NOT NULL DEFAULT 1 CHECK (is_veg IN (0, 1)),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise > 0),
  line_total_paise INTEGER NOT NULL CHECK (line_total_paise > 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- 15. Order State Events
CREATE TABLE IF NOT EXISTS order_state_events (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT NOT NULL,
  staff_user_id INTEGER REFERENCES staff_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_state_events_order ON order_state_events(order_id);

-- 16. Idempotency Keys
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id SERIAL PRIMARY KEY,
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  order_id INTEGER REFERENCES orders(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(scope, idempotency_key)
);
