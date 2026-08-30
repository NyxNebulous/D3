import { randomBytes } from "node:crypto";
import { Router } from "express";
import { createOrderSchema } from "@d3/shared";
import type { Database } from "../../db/database.js";
import { transaction } from "../../db/database.js";
import { asyncHandler, AppError } from "../../middleware/errors.js";
import { createRateLimiter } from "../../middleware/rateLimit.js";
import { requireCustomerSession, requireStaffSession } from "../../middleware/sessionAuth.js";
import { validateBody } from "../../middleware/requestValidation.js";
import { getOrCreateCart } from "../cart/cart.routes.js";

type PendingCartItemRow = {
  menuItemId: number;
  name: string;
  isVeg: boolean;
  quantity: number;
  unitPricePaise: number;
};

type OrderRow = {
  id: number;
  publicOrderNumber: string;
  customerName: string;
  mobileNumber: string;
  tableLabel: string;
  totalPaise: number;
  currency: string;
  paymentState: "UNPAID" | "PAID_OFFLINE";
  fulfillmentState: "PENDING" | "COMPLETED";
  paidAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

type OrderItemRow = {
  id: number;
  menuItemId: number | null;
  itemName: string;
  isVeg: boolean;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
};

export function createOrdersRouter(database: Database): Router {
  const router = Router();

  router.post(
    "/orders",
    requireCustomerSession(database),
    createRateLimiter({
      keyPrefix: "order-create",
      limit: 20,
      windowMs: 10 * 60 * 1000,
      key: (request) => String(request.customerSession?.id ?? request.ip)
    }),
    validateBody(createOrderSchema),
    asyncHandler((request, response) => {
      if (!request.customerSession) {
        throw new AppError(401, "CUSTOMER_AUTH_REQUIRED", "Customer authentication is required");
      }

      const customerSession = request.customerSession;
      const idempotencyKey = readIdempotencyKey(request.get("idempotency-key"));
      const scope = `customer-session:${customerSession.id}:create-order`;
      const cartId = getOrCreateCart(database, customerSession.id);

      const orderId = transaction(database, () => {
        const existing = database
          .prepare(
            `
              SELECT order_id AS orderId
              FROM idempotency_keys
              WHERE scope = ? AND idempotency_key = ?
            `
          )
          .get(scope, idempotencyKey) as { orderId: number | null } | undefined;

        if (existing?.orderId) {
          return existing.orderId;
        }

        const cartItems = database
          .prepare(
            `
              SELECT
                menu_items.id AS menuItemId,
                menu_items.name,
                menu_items.is_veg AS isVeg,
                cart_items.quantity,
                menu_items.price_paise AS unitPricePaise
              FROM cart_items
              JOIN menu_items ON menu_items.id = cart_items.menu_item_id
              WHERE cart_items.cart_id = ?
              ORDER BY menu_items.id ASC
            `
          )
          .all(cartId) as Array<Omit<PendingCartItemRow, "isVeg"> & { isVeg: number }>[];

        const cartItemsNormalized = cartItems.map((item) => ({
          ...item,
          isVeg: Boolean(item.isVeg)
        }));

        if (cartItems.length === 0) {
          throw new AppError(400, "CART_EMPTY", "Cart is empty");
        }

        const totalPaise = cartItems.reduce(
          (sum, item) => sum + item.quantity * item.unitPricePaise,
          0
        );

        const publicOrderNumber = createPublicOrderNumber();
        const insertOrder = database
          .prepare(
            `
              INSERT INTO orders (
                public_order_number,
                customer_id,
                customer_session_id,
                dining_table_id,
                total_paise
              )
              VALUES (?, ?, ?, ?, ?)
            `
          )
          .run(
            publicOrderNumber,
            customerSession.customerId,
            customerSession.id,
            customerSession.diningTableId,
            totalPaise
          );

        const createdOrderId = Number(insertOrder.lastInsertRowid);

        const insertItem = database.prepare(
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
        );

        for (const item of cartItemsNormalized) {
          insertItem.run(
            createdOrderId,
            item.menuItemId,
            item.name,
            item.isVeg ? 1 : 0,
            item.quantity,
            item.unitPricePaise,
            item.quantity * item.unitPricePaise
          );
        }

        database
          .prepare(
            `
              INSERT INTO order_state_events (order_id, event_type, to_state)
              VALUES (?, 'ORDER_CREATED', 'PENDING')
            `
          )
          .run(createdOrderId);

        database.prepare("DELETE FROM cart_items WHERE cart_id = ?").run(cartId);
        database
          .prepare(
            `
              INSERT INTO idempotency_keys (scope, idempotency_key, order_id)
              VALUES (?, ?, ?)
            `
          )
          .run(scope, idempotencyKey, createdOrderId);

        return createdOrderId;
      });

      response.status(201).json({ order: readOrder(database, orderId) });
    })
  );

  router.get(
    "/orders/current",
    requireCustomerSession(database),
    asyncHandler((request, response) => {
      if (!request.customerSession) {
        throw new AppError(401, "CUSTOMER_AUTH_REQUIRED", "Customer authentication is required");
      }

      const orderIds = database
        .prepare(
          `
            SELECT id
            FROM orders
            WHERE customer_session_id = ?
            ORDER BY created_at DESC, id DESC
          `
        )
        .all(request.customerSession.id) as { id: number }[];

      response.json({ orders: orderIds.map((row) => readOrder(database, row.id)) });
    })
  );

  router.get(
    "/orders/:orderId",
    requireCustomerSession(database),
    asyncHandler((request, response) => {
      if (!request.customerSession) {
        throw new AppError(401, "CUSTOMER_AUTH_REQUIRED", "Customer authentication is required");
      }

      const orderId = readPositiveId(request.params.orderId);
      const order = readOrder(database, orderId);
      assertCustomerOwnsOrder(database, orderId, request.customerSession.id);
      response.json({ order });
    })
  );

  router.get(
    "/admin/orders",
    requireStaffSession(database),
    asyncHandler((_request, response) => {
      const orderIds = database
        .prepare(
          `
            SELECT id
            FROM orders
            ORDER BY created_at DESC, id DESC
            LIMIT 200
          `
        )
        .all() as { id: number }[];

      response.json({ orders: orderIds.map((row) => readOrder(database, row.id)) });
    })
  );

  router.get(
    "/admin/orders/:orderId",
    requireStaffSession(database),
    asyncHandler((request, response) => {
      response.json({ order: readOrder(database, readPositiveId(request.params.orderId)) });
    })
  );

  router.post(
    "/admin/orders/:orderId/mark-paid-offline",
    requireStaffSession(database),
    asyncHandler((request, response) => {
      if (!request.staffSession) {
        throw new AppError(401, "STAFF_AUTH_REQUIRED", "Staff authentication is required");
      }

      const staffUserId = request.staffSession.staffUserId;
      const orderId = readPositiveId(request.params.orderId);

      transaction(database, () => {
        const order = readOrder(database, orderId);

        if (order.paymentState === "PAID_OFFLINE") {
          return;
        }

        database
          .prepare(
            `
              UPDATE orders
              SET payment_state = 'PAID_OFFLINE', paid_at = CURRENT_TIMESTAMP
              WHERE id = ? AND payment_state = 'UNPAID'
            `
          )
          .run(orderId);

        database
          .prepare(
            `
              INSERT INTO order_state_events (
                order_id,
                event_type,
                from_state,
                to_state,
                staff_user_id
              )
              VALUES (?, 'PAYMENT_STATE_CHANGED', 'UNPAID', 'PAID_OFFLINE', ?)
            `
          )
          .run(orderId, staffUserId);
      });

      response.json({ order: readOrder(database, orderId) });
    })
  );

  router.post(
    "/admin/orders/:orderId/mark-completed",
    requireStaffSession(database),
    asyncHandler((request, response) => {
      if (!request.staffSession) {
        throw new AppError(401, "STAFF_AUTH_REQUIRED", "Staff authentication is required");
      }

      const staffUserId = request.staffSession.staffUserId;
      const orderId = readPositiveId(request.params.orderId);

      transaction(database, () => {
        const order = readOrder(database, orderId);

        if (order.fulfillmentState === "COMPLETED") {
          return;
        }

        if (order.paymentState !== "PAID_OFFLINE") {
          throw new AppError(409, "PAYMENT_REQUIRED", "Record offline payment before completing the order");
        }

        database
          .prepare(
            `
              UPDATE orders
              SET fulfillment_state = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
              WHERE id = ? AND fulfillment_state = 'PENDING'
            `
          )
          .run(orderId);

        database
          .prepare(
            `
              INSERT INTO order_state_events (
                order_id,
                event_type,
                from_state,
                to_state,
                staff_user_id
              )
              VALUES (?, 'FULFILLMENT_STATE_CHANGED', 'PENDING', 'COMPLETED', ?)
            `
          )
          .run(orderId, staffUserId);
      });

      response.json({ order: readOrder(database, orderId) });
    })
  );

  return router;
}

export function readOrder(database: Database, orderId: number) {
  const row = database
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
        JOIN customers ON customers.id = orders.customer_id
        JOIN dining_tables ON dining_tables.id = orders.dining_table_id
        WHERE orders.id = ?
      `
    )
    .get(orderId) as OrderRow | undefined;

  if (!row) {
    throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  }

  const items = database
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
    .all(orderId) as Array<Omit<OrderItemRow, "isVeg"> & { isVeg: number }>[];

  return {
    ...row,
    items: items.map((item) => ({ ...item, isVeg: Boolean(item.isVeg) }))
  };
}

function assertCustomerOwnsOrder(
  database: Database,
  orderId: number,
  customerSessionId: number
): void {
  const owned = database
    .prepare("SELECT id FROM orders WHERE id = ? AND customer_session_id = ?")
    .get(orderId, customerSessionId);

  if (!owned) {
    throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  }
}

function readIdempotencyKey(value: string | undefined): string {
  if (!value || !/^[A-Za-z0-9._:-]{8,160}$/.test(value)) {
    throw new AppError(400, "IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key header is required");
  }

  return value;
}

function readPositiveId(value: string | string[] | undefined): number {
  if (Array.isArray(value)) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid identifier");
  }

  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid identifier");
  }

  return id;
}

function createPublicOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `D3-${date}-${suffix}`;
}
