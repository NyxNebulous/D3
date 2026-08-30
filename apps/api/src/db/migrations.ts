import type { Database } from "./database.js";
import { transaction } from "./database.js";

type Migration = {
  id: number;
  name: string;
  sql: string;
};

const migrations: Migration[] = [
  {
    id: 1,
    name: "initial_v1_schema",
    sql: `
      CREATE TABLE dining_tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL UNIQUE,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE table_qr_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        qr_identifier TEXT NOT NULL UNIQUE,
        dining_table_id INTEGER NOT NULL REFERENCES dining_tables(id),
        revoked_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_table_qr_codes_table ON table_qr_codes(dining_table_id);

      CREATE TABLE pre_verification_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_hash TEXT NOT NULL UNIQUE,
        dining_table_id INTEGER NOT NULL REFERENCES dining_tables(id),
        table_qr_code_id INTEGER NOT NULL REFERENCES table_qr_codes(id),
        expires_at TEXT NOT NULL,
        consumed_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_pre_verification_sessions_hash ON pre_verification_sessions(token_hash);

      CREATE TABLE customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        mobile_number TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE customer_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_hash TEXT NOT NULL UNIQUE,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        dining_table_id INTEGER NOT NULL REFERENCES dining_tables(id),
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_customer_sessions_hash ON customer_sessions(token_hash);
      CREATE INDEX idx_customer_sessions_customer ON customer_sessions(customer_id);

      CREATE TABLE otp_challenges (
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

      CREATE INDEX idx_otp_challenges_pre_session ON otp_challenges(pre_session_id);
      CREATE INDEX idx_otp_challenges_mobile ON otp_challenges(mobile_number);

      CREATE TABLE staff_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE staff_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_hash TEXT NOT NULL UNIQUE,
        staff_user_id INTEGER NOT NULL REFERENCES staff_users(id),
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_staff_sessions_hash ON staff_sessions(token_hash);

      CREATE TABLE menu_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE menu_items (
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

      CREATE INDEX idx_menu_items_category ON menu_items(category_id);

      CREATE TABLE carts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_session_id INTEGER NOT NULL UNIQUE REFERENCES customer_sessions(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE cart_items (
        cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
        menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
        quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 99),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (cart_id, menu_item_id)
      );

      CREATE TABLE orders (
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

      CREATE INDEX idx_orders_session ON orders(customer_session_id);
      CREATE INDEX idx_orders_table ON orders(dining_table_id);
      CREATE INDEX idx_orders_created_at ON orders(created_at);

      CREATE TABLE order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        menu_item_id INTEGER REFERENCES menu_items(id),
        item_name TEXT NOT NULL,
        is_veg INTEGER NOT NULL DEFAULT 1 CHECK (is_veg IN (0, 1)),
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise > 0),
        line_total_paise INTEGER NOT NULL CHECK (line_total_paise > 0)
      );

      CREATE INDEX idx_order_items_order ON order_items(order_id);

      CREATE TABLE order_state_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        from_state TEXT,
        to_state TEXT NOT NULL,
        staff_user_id INTEGER REFERENCES staff_users(id),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_order_state_events_order ON order_state_events(order_id);

      CREATE TABLE idempotency_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scope TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        order_id INTEGER REFERENCES orders(id),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(scope, idempotency_key)
      );
    `
  },
  {
    id: 2,
    name: "add_veg_flags_to_menu_and_orders",
    sql: `
      ALTER TABLE menu_items ADD COLUMN is_veg INTEGER NOT NULL DEFAULT 1 CHECK (is_veg IN (0, 1));
      ALTER TABLE order_items ADD COLUMN is_veg INTEGER NOT NULL DEFAULT 1 CHECK (is_veg IN (0, 1));
    `
  }
];

export function runMigrations(database: Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  for (const migration of migrations) {
    const existing = database
      .prepare("SELECT id FROM schema_migrations WHERE id = ?")
      .get(migration.id);

    if (existing) {
      continue;
    }

    if (migration.id === 2) {
      const menuInfo = database.prepare("PRAGMA table_info(menu_items)").all() as Array<{ name: string }>;
      const orderInfo = database.prepare("PRAGMA table_info(order_items)").all() as Array<{ name: string }>;
      const hasMenuFlag = menuInfo.some((column) => column.name === "is_veg");
      const hasOrderFlag = orderInfo.some((column) => column.name === "is_veg");

      if (hasMenuFlag && hasOrderFlag) {
        database
          .prepare("INSERT INTO schema_migrations (id, name) VALUES (?, ?)")
          .run(migration.id, migration.name);
        continue;
      }
    }

    transaction(database, () => {
      database.exec(migration.sql);
      database
        .prepare("INSERT INTO schema_migrations (id, name) VALUES (?, ?)")
        .run(migration.id, migration.name);
    });
  }
}

