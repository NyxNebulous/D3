import type { D1Database, CustomerSession, StaffSession } from "../types.js";

export type MenuItemRecord = {
  id: number;
  categoryId: number;
  name: string;
  pricePaise: number;
  isVeg: boolean;
  sortOrder: number;
};

export type MenuCategoryRecord = {
  id: number;
  name: string;
  sortOrder: number;
  items: MenuItemRecord[];
};

export type OrderItemRecord = {
  id: number;
  menuItemId: number;
  itemName: string;
  isVeg: boolean;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
};

export type OrderRecord = {
  id: number;
  publicOrderNumber: string;
  customerName: string | null;
  mobileNumber: string | null;
  tableLabel: string;
  totalPaise: number;
  currency: string;
  paymentState: string;
  fulfillmentState: string;
  paidAt: string | null;
  completedAt: string | null;
  createdAt: string;
  items: OrderItemRecord[];
};

export async function validateQrCode(db: D1Database, qrId: string) {
  const row = await db
    .prepare(
      `
      SELECT
        table_qr_codes.id,
        table_qr_codes.dining_table_id AS diningTableId,
        dining_tables.label AS tableLabel
      FROM table_qr_codes
      JOIN dining_tables ON dining_tables.id = table_qr_codes.dining_table_id
      WHERE table_qr_codes.qr_identifier = ?
        AND table_qr_codes.revoked_at IS NULL
        AND dining_tables.active = 1
      `
    )
    .bind(qrId)
    .first<{ id: number; diningTableId: number; tableLabel: string }>();

  return row ?? null;
}

export async function createPreSession(
  db: D1Database,
  diningTableId: number,
  tableQrCodeId: number,
  tokenHash: string
) {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await db
    .prepare(
      `
      INSERT INTO pre_verification_sessions (token_hash, dining_table_id, table_qr_code_id, expires_at)
      VALUES (?, ?, ?, ?)
      `
    )
    .bind(tokenHash, diningTableId, tableQrCodeId, expiresAt)
    .run();
}

export async function getPreSession(db: D1Database, tokenHash: string) {
  const row = await db
    .prepare(
      `
      SELECT
        id,
        dining_table_id AS diningTableId,
        table_qr_code_id AS tableQrCodeId,
        expires_at AS expiresAt
      FROM pre_verification_sessions
      WHERE token_hash = ?
        AND consumed_at IS NULL
        AND datetime(expires_at) > datetime('now')
      `
    )
    .bind(tokenHash)
    .first<{ id: number; diningTableId: number; tableQrCodeId: number; expiresAt: string }>();

  return row ?? null;
}

export async function getCustomerSession(
  db: D1Database,
  tokenHash: string
): Promise<CustomerSession | null> {
  const row = await db
    .prepare(
      `
      SELECT
        customer_sessions.id,
        customer_sessions.customer_id AS customerId,
        customers.name AS customerName,
        customers.mobile_number AS customerMobile,
        customer_sessions.dining_table_id AS diningTableId,
        dining_tables.label AS tableLabel,
        customer_sessions.expires_at AS expiresAt
      FROM customer_sessions
      JOIN customers ON customers.id = customer_sessions.customer_id
      JOIN dining_tables ON dining_tables.id = customer_sessions.dining_table_id
      WHERE customer_sessions.token_hash = ?
        AND customer_sessions.revoked_at IS NULL
        AND datetime(customer_sessions.expires_at) > datetime('now')
      `
    )
    .bind(tokenHash)
    .first<CustomerSession>();

  return row ?? null;
}

export async function authenticateCustomer(
  db: D1Database,
  preSessionId: number,
  diningTableId: number,
  name: string,
  mobileNumber: string,
  sessionTokenHash: string
) {
  // Find or insert customer
  let customer = await db
    .prepare(`SELECT id, name, mobile_number FROM customers WHERE mobile_number = ?`)
    .bind(mobileNumber)
    .first<{ id: number; name: string; mobile_number: string }>();

  if (!customer) {
    const res = await db
      .prepare(`INSERT INTO customers (name, mobile_number) VALUES (?, ?)`)
      .bind(name, mobileNumber)
      .run();
    const customerId = res.meta.last_row_id ?? 1;
    customer = { id: customerId, name, mobile_number: mobileNumber };
  } else {
    // Update name if changed
    await db
      .prepare(`UPDATE customers SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(name, customer.id)
      .run();
  }

  // Consume pre-session
  await db
    .prepare(`UPDATE pre_verification_sessions SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(preSessionId)
    .run();

  // Create session (24h validity)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await db
    .prepare(
      `
      INSERT INTO customer_sessions (token_hash, customer_id, dining_table_id, expires_at)
      VALUES (?, ?, ?, ?)
      `
    )
    .bind(sessionTokenHash, customer.id, diningTableId, expiresAt)
    .run();

  return customer;
}

export async function getStaffSession(
  db: D1Database,
  tokenHash: string
): Promise<StaffSession | null> {
  const row = await db
    .prepare(
      `
      SELECT
        staff_sessions.id,
        staff_sessions.staff_user_id AS staffUserId,
        staff_users.username AS username,
        staff_sessions.expires_at AS expiresAt
      FROM staff_sessions
      JOIN staff_users ON staff_users.id = staff_sessions.staff_user_id
      WHERE staff_sessions.token_hash = ?
        AND staff_sessions.revoked_at IS NULL
        AND datetime(staff_sessions.expires_at) > datetime('now')
      `
    )
    .bind(tokenHash)
    .first<StaffSession>();

  return row ?? null;
}

export async function getMenuTree(
  db: D1Database,
  _isAdmin = false
): Promise<MenuCategoryRecord[]> {
  const categoriesQuery = `SELECT id, name, sort_order AS sortOrder FROM menu_categories ORDER BY sort_order ASC, name ASC`;
  const itemsQuery = `SELECT id, category_id AS categoryId, name, price_paise AS pricePaise, is_veg AS isVeg, sort_order AS sortOrder FROM menu_items ORDER BY sort_order ASC, name ASC`;

  const [categoriesRes, itemsRes] = await Promise.all([
    db.prepare(categoriesQuery).all<{ id: number; name: string; sortOrder: number }>(),
    db.prepare(itemsQuery).all<{
      id: number;
      categoryId: number;
      name: string;
      pricePaise: number;
      isVeg: number;
      sortOrder: number;
    }>()
  ]);

  const itemsByCategory = new Map<number, MenuItemRecord[]>();
  for (const item of itemsRes.results) {
    const list = itemsByCategory.get(item.categoryId) ?? [];
    list.push({
      id: item.id,
      categoryId: item.categoryId,
      name: item.name,
      pricePaise: item.pricePaise,
      isVeg: Boolean(item.isVeg),
      sortOrder: item.sortOrder
    });
    itemsByCategory.set(item.categoryId, list);
  }

  return categoriesRes.results.map((c) => ({
    id: c.id,
    name: c.name,
    sortOrder: c.sortOrder,
    items: itemsByCategory.get(c.id) ?? []
  }));
}

export async function getOrCreateCart(
  db: D1Database,
  customerSessionId: number,
  _customerId: number,
  _diningTableId: number
) {
  let cart = await db
    .prepare(
      `
      SELECT id
      FROM carts
      WHERE customer_session_id = ?
      `
    )
    .bind(customerSessionId)
    .first<{ id: number }>();

  if (!cart) {
    const res = await db
      .prepare(
        `
        INSERT INTO carts (customer_session_id)
        VALUES (?)
        `
      )
      .bind(customerSessionId)
      .run();
    cart = { id: res.meta.last_row_id ?? 1 };
  }

  const itemsRes = await db
    .prepare(
      `
      SELECT
        cart_items.menu_item_id AS menuItemId,
        menu_items.name,
        menu_categories.name AS categoryName,
        menu_items.is_veg AS isVeg,
        cart_items.quantity,
        menu_items.price_paise AS unitPricePaise,
        (cart_items.quantity * menu_items.price_paise) AS lineTotalPaise
      FROM cart_items
      JOIN menu_items ON menu_items.id = cart_items.menu_item_id
      JOIN menu_categories ON menu_categories.id = menu_items.category_id
      WHERE cart_items.cart_id = ?
      ORDER BY menu_categories.sort_order ASC, menu_items.sort_order ASC, menu_items.name ASC
      `
    )
    .bind(cart.id)
    .all<{
      menuItemId: number;
      name: string;
      categoryName: string;
      isVeg: number;
      quantity: number;
      unitPricePaise: number;
      lineTotalPaise: number;
    }>();

  const items = itemsRes.results.map((i) => ({
    ...i,
    isVeg: Boolean(i.isVeg)
  }));

  const totalPaise = items.reduce((sum, item) => sum + item.lineTotalPaise, 0);

  return {
    cart: {
      id: cart.id,
      items,
      totalPaise,
      currency: "INR"
    }
  };
}

export async function setCartItem(
  db: D1Database,
  cartId: number,
  menuItemId: number,
  quantity: number
) {
  if (quantity <= 0) {
    await db
      .prepare(`DELETE FROM cart_items WHERE cart_id = ? AND menu_item_id = ?`)
      .bind(cartId, menuItemId)
      .run();
  } else {
    await db
      .prepare(
        `
        INSERT INTO cart_items (cart_id, menu_item_id, quantity)
        VALUES (?, ?, ?)
        ON CONFLICT(cart_id, menu_item_id) DO UPDATE SET
          quantity = excluded.quantity,
          updated_at = CURRENT_TIMESTAMP
        `
      )
      .bind(cartId, menuItemId, quantity)
      .run();
  }

  await db
    .prepare(`UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(cartId)
    .run();
}

export async function clearCart(db: D1Database, cartId: number) {
  await db.prepare(`DELETE FROM cart_items WHERE cart_id = ?`).bind(cartId).run();
  await db
    .prepare(`UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(cartId)
    .run();
}

export async function createOrderFromCart(
  db: D1Database,
  customerSessionId: number,
  customerId: number,
  diningTableId: number,
  idempotencyKey?: string
) {
  const scope = `customer-session:${customerSessionId}:create-order`;

  // Check idempotency
  if (idempotencyKey) {
    const existing = await db
      .prepare(`SELECT order_id AS orderId FROM idempotency_keys WHERE scope = ? AND idempotency_key = ?`)
      .bind(scope, idempotencyKey)
      .first<{ orderId: number }>();
    if (existing?.orderId) {
      return getOrderById(db, existing.orderId);
    }
  }

  const cart = await db
    .prepare(`SELECT id FROM carts WHERE customer_session_id = ?`)
    .bind(customerSessionId)
    .first<{ id: number }>();

  if (!cart) {
    throw new Error("Cart is empty");
  }

  const itemsRes = await db
    .prepare(
      `
      SELECT
        cart_items.menu_item_id AS menuItemId,
        menu_items.name AS itemName,
        menu_items.is_veg AS isVeg,
        cart_items.quantity,
        menu_items.price_paise AS unitPricePaise
      FROM cart_items
      JOIN menu_items ON menu_items.id = cart_items.menu_item_id
      WHERE cart_items.cart_id = ?
      `
    )
    .bind(cart.id)
    .all<{
      menuItemId: number;
      itemName: string;
      isVeg: number;
      quantity: number;
      unitPricePaise: number;
    }>();

  if (itemsRes.results.length === 0) {
    throw new Error("Cart has no items to order");
  }

  const totalPaise = itemsRes.results.reduce(
    (sum, item) => sum + item.quantity * item.unitPricePaise,
    0
  );

  // Generate sequential public order number: #101, #102, etc.
  const countRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM orders`)
    .first<{ total: number }>();
  const orderNumber = `#${(countRow?.total ?? 0) + 101}`;

  const insertOrder = await db
    .prepare(
      `
      INSERT INTO orders (
        public_order_number,
        customer_session_id,
        customer_id,
        dining_table_id,
        total_paise,
        currency,
        payment_state,
        fulfillment_state
      )
      VALUES (?, ?, ?, ?, ?, 'INR', 'UNPAID', 'PENDING')
      `
    )
    .bind(
      orderNumber,
      customerSessionId,
      customerId,
      diningTableId,
      totalPaise
    )
    .run();

  const orderId = insertOrder.meta.last_row_id!;

  // Insert items and clear cart
  const itemStatements = itemsRes.results.map((item) =>
    db
      .prepare(
        `
        INSERT INTO order_items (
          order_id,
          menu_item_id,
          item_name,
          is_veg,
          quantity,
          unit_price_paise,
          line_total_paise
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      )
      .bind(
        orderId,
        item.menuItemId,
        item.itemName,
        item.isVeg,
        item.quantity,
        item.unitPricePaise,
        item.quantity * item.unitPricePaise
      )
  );

  const batchStatements = [
    ...itemStatements,
    db.prepare(`DELETE FROM cart_items WHERE cart_id = ?`).bind(cart.id)
  ];

  if (idempotencyKey) {
    batchStatements.push(
      db
        .prepare(`INSERT INTO idempotency_keys (scope, idempotency_key, order_id) VALUES (?, ?, ?)`)
        .bind(scope, idempotencyKey, orderId)
    );
  }

  await db.batch(batchStatements);

  return getOrderById(db, orderId);
}

export async function getOrderById(
  db: D1Database,
  orderId: number
): Promise<OrderRecord | null> {
  const order = await db
    .prepare(
      `
      SELECT
        orders.id,
        orders.public_order_number AS publicOrderNumber,
        customers.name AS customerName,
        customers.mobile_number AS mobileNumber,
        dining_tables.label AS tableLabel,
        orders.total_paise AS totalPaise,
        orders.currency,
        orders.payment_state AS paymentState,
        orders.fulfillment_state AS fulfillmentState,
        orders.paid_at AS paidAt,
        orders.completed_at AS completedAt,
        orders.created_at AS createdAt
      FROM orders
      JOIN dining_tables ON dining_tables.id = orders.dining_table_id
      LEFT JOIN customers ON customers.id = orders.customer_id
      WHERE orders.id = ?
      `
    )
    .bind(orderId)
    .first<Omit<OrderRecord, "items">>();

  if (!order) return null;

  const itemsRes = await db
    .prepare(
      `
      SELECT
        id,
        menu_item_id AS menuItemId,
        item_name AS itemName,
        is_veg AS isVeg,
        quantity,
        unit_price_paise AS unitPricePaise,
        line_total_paise AS lineTotalPaise
      FROM order_items
      WHERE order_id = ?
      ORDER BY id ASC
      `
    )
    .bind(orderId)
    .all<{
      id: number;
      menuItemId: number;
      itemName: string;
      isVeg: number;
      quantity: number;
      unitPricePaise: number;
      lineTotalPaise: number;
    }>();

  return {
    ...order,
    items: itemsRes.results.map((item) => ({
      ...item,
      isVeg: Boolean(item.isVeg)
    }))
  };
}

export async function getCustomerOrders(
  db: D1Database,
  customerSessionId: number,
  customerId?: number,
  _diningTableId?: number
): Promise<OrderRecord[]> {
  let query = `
    SELECT id
    FROM orders
    WHERE customer_session_id = ?
  `;
  const binds: (number | string)[] = [customerSessionId];

  if (customerId) {
    query = `
      SELECT id
      FROM orders
      WHERE customer_session_id = ?
         OR (customer_id = ? AND (payment_state = 'UNPAID' OR datetime(created_at) > datetime('now', '-24 hours')))
      ORDER BY created_at DESC, id DESC
    `;
    binds.push(customerId);
  } else {
    query += ` ORDER BY created_at DESC, id DESC`;
  }

  const orderIdsRes = await db
    .prepare(query)
    .bind(...binds)
    .all<{ id: number }>();

  const orders = await Promise.all(
    orderIdsRes.results.map((row) => getOrderById(db, row.id))
  );

  return orders.filter((o): o is OrderRecord => o !== null);
}

// FIFO sequence for kitchen staff: oldest orders at the top, new orders at the bottom!
export async function getAdminLiveOrders(db: D1Database): Promise<OrderRecord[]> {
  const orderIdsRes = await db
    .prepare(
      `
      SELECT id
      FROM orders
      ORDER BY created_at ASC, id ASC
      LIMIT 200
      `
    )
    .all<{ id: number }>();

  const orders = await Promise.all(
    orderIdsRes.results.map((row) => getOrderById(db, row.id))
  );

  return orders.filter((o): o is OrderRecord => o !== null);
}

export async function markOrderPaid(
  db: D1Database,
  orderId: number,
  staffUserId: number
) {
  const order = await getOrderById(db, orderId);
  if (!order || order.paymentState === "PAID_OFFLINE") {
    return order;
  }

  await db.batch([
    db
      .prepare(
        `UPDATE orders SET payment_state = 'PAID_OFFLINE', paid_at = CURRENT_TIMESTAMP WHERE id = ?`
      )
      .bind(orderId),
    db
      .prepare(
        `
        INSERT INTO order_state_events (order_id, event_type, from_state, to_state, staff_user_id)
        VALUES (?, 'PAYMENT_STATE_CHANGED', 'UNPAID', 'PAID_OFFLINE', ?)
        `
      )
      .bind(orderId, staffUserId)
  ]);

  return getOrderById(db, orderId);
}

export async function markOrderCompleted(
  db: D1Database,
  orderId: number,
  staffUserId: number
) {
  const order = await getOrderById(db, orderId);
  if (!order || order.fulfillmentState === "COMPLETED") {
    return order;
  }

  await db.batch([
    db
      .prepare(
        `UPDATE orders SET fulfillment_state = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE id = ?`
      )
      .bind(orderId),
    db
      .prepare(
        `
        INSERT INTO order_state_events (order_id, event_type, from_state, to_state, staff_user_id)
        VALUES (?, 'FULFILLMENT_STATE_CHANGED', 'PENDING', 'COMPLETED', ?)
        `
      )
      .bind(orderId, staffUserId)
  ]);

  return getOrderById(db, orderId);
}

