import { Router } from "express";
import { updateCartItemSchema } from "@d3/shared";
import type { Database } from "../../db/database.js";
import { asyncHandler, AppError } from "../../middleware/errors.js";
import { createRateLimiter } from "../../middleware/rateLimit.js";
import { requireCustomerSession } from "../../middleware/sessionAuth.js";
import { validateBody } from "../../middleware/requestValidation.js";

type CartRow = {
  id: number;
};

type CartItemRow = {
  menuItemId: number;
  name: string;
  categoryName: string;
  isVeg: boolean;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
};

export function createCartRouter(database: Database): Router {
  const router = Router();

  router.get(
    "/cart",
    requireCustomerSession(database),
    asyncHandler((request, response) => {
      if (!request.customerSession) {
        throw new AppError(401, "CUSTOMER_AUTH_REQUIRED", "Customer authentication is required");
      }

      const cartId = getOrCreateCart(database, request.customerSession.id);
      response.json(readCart(database, cartId));
    })
  );

  router.put(
    "/cart/items",
    requireCustomerSession(database),
    createRateLimiter({
      keyPrefix: "cart-update",
      limit: 80,
      windowMs: 5 * 60 * 1000,
      key: (request) => String(request.customerSession?.id ?? request.ip)
    }),
    validateBody(updateCartItemSchema),
    asyncHandler((request, response) => {
      if (!request.customerSession) {
        throw new AppError(401, "CUSTOMER_AUTH_REQUIRED", "Customer authentication is required");
      }

      const body = request.body as { menuItemId: number; quantity: number };
      const cartId = getOrCreateCart(database, request.customerSession.id);

      const menuItem = database
        .prepare("SELECT id FROM menu_items WHERE id = ?")
        .get(body.menuItemId);

      if (!menuItem) {
        throw new AppError(404, "MENU_ITEM_NOT_FOUND", "Menu item not found");
      }

      if (body.quantity === 0) {
        database
          .prepare("DELETE FROM cart_items WHERE cart_id = ? AND menu_item_id = ?")
          .run(cartId, body.menuItemId);
      } else {
        database
          .prepare(
            `
              INSERT INTO cart_items (cart_id, menu_item_id, quantity)
              VALUES (?, ?, ?)
              ON CONFLICT(cart_id, menu_item_id) DO UPDATE SET
                quantity = excluded.quantity,
                updated_at = CURRENT_TIMESTAMP
            `
          )
          .run(cartId, body.menuItemId, body.quantity);
      }

      database.prepare("UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(cartId);
      response.json(readCart(database, cartId));
    })
  );

  return router;
}

export function getOrCreateCart(database: Database, customerSessionId: number): number {
  const existing = database
    .prepare("SELECT id FROM carts WHERE customer_session_id = ?")
    .get(customerSessionId) as CartRow | undefined;

  if (existing) {
    return existing.id;
  }

  const result = database
    .prepare("INSERT INTO carts (customer_session_id) VALUES (?)")
    .run(customerSessionId);

  return Number(result.lastInsertRowid);
}

export function readCart(database: Database, cartId: number) {
  const items = database
    .prepare(
      `
        SELECT
          menu_items.id AS menuItemId,
          menu_items.name,
          menu_categories.name AS categoryName,
          menu_items.is_veg AS isVeg,
          cart_items.quantity,
          menu_items.price_paise AS unitPricePaise,
          cart_items.quantity * menu_items.price_paise AS lineTotalPaise
        FROM cart_items
        JOIN menu_items ON menu_items.id = cart_items.menu_item_id
        JOIN menu_categories ON menu_categories.id = menu_items.category_id
        WHERE cart_items.cart_id = ?
        ORDER BY menu_categories.sort_order ASC, menu_items.sort_order ASC, menu_items.name ASC
      `
    )
    .all(cartId) as Array<Omit<CartItemRow, "isVeg"> & { isVeg: number }>;

  const normalizedItems = items.map((item) => ({
    ...item,
    isVeg: Boolean(item.isVeg)
  }));

  const totalPaise = normalizedItems.reduce((sum, item) => sum + item.lineTotalPaise, 0);

  return {
    cart: {
      id: cartId,
      items: normalizedItems,
      totalPaise,
      currency: "INR"
    }
  };
}

