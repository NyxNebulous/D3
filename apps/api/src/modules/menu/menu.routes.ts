import { Router } from "express";
import {
  menuCategoryCreateSchema,
  menuCategoryUpdateSchema,
  menuItemCreateSchema,
  menuItemUpdateSchema
} from "@d3/shared";
import type { Database } from "../../db/database.js";
import { asyncHandler, AppError } from "../../middleware/errors.js";
import { requireStaffSession } from "../../middleware/sessionAuth.js";
import { validateBody } from "../../middleware/requestValidation.js";

type MenuCategoryRow = {
  id: number;
  name: string;
  sortOrder: number;
};

type MenuItemRow = {
  id: number;
  categoryId: number;
  name: string;
  pricePaise: number;
  isVeg: boolean;
  sortOrder: number;
};

export function createMenuRouter(database: Database): Router {
  const router = Router();

  router.get(
    "/menu",
    asyncHandler((_request, response) => {
      response.json(readMenu(database));
    })
  );

  router.get(
    "/admin/menu",
    requireStaffSession(database),
    asyncHandler((_request, response) => {
      response.json(readMenu(database));
    })
  );

  router.post(
    "/admin/menu/categories",
    requireStaffSession(database),
    validateBody(menuCategoryCreateSchema),
    asyncHandler((request, response) => {
      const body = request.body as { name: string; sortOrder?: number };
      const result = database
        .prepare("INSERT INTO menu_categories (name, sort_order) VALUES (?, ?)")
        .run(body.name, body.sortOrder ?? 0);

      const category = readCategory(database, Number(result.lastInsertRowid));
      response.status(201).json({ category });
    })
  );

  router.patch(
    "/admin/menu/categories/:categoryId",
    requireStaffSession(database),
    validateBody(menuCategoryUpdateSchema),
    asyncHandler((request, response) => {
      const id = Number(request.params.categoryId);
      assertPositiveId(id);

      const current = readCategory(database, id);
      const body = request.body as { name?: string; sortOrder?: number };

      if (Object.keys(body).length === 0) {
        throw new AppError(400, "VALIDATION_ERROR", "No changes provided");
      }

      database
        .prepare(
          `
            UPDATE menu_categories
            SET name = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `
        )
        .run(body.name ?? current.name, body.sortOrder ?? current.sortOrder, id);

      response.json({ category: readCategory(database, id) });
    })
  );

  router.post(
    "/admin/menu/items",
    requireStaffSession(database),
    validateBody(menuItemCreateSchema),
    asyncHandler((request, response) => {
      const body = request.body as {
        categoryId: number;
        name: string;
        pricePaise: number;
        isVeg: boolean;
        sortOrder?: number;
      };

      readCategory(database, body.categoryId);

      const result = database
        .prepare(
          `
            INSERT INTO menu_items (category_id, name, price_paise, is_veg, sort_order)
            VALUES (?, ?, ?, ?, ?)
          `
        )
        .run(body.categoryId, body.name, body.pricePaise, body.isVeg ? 1 : 0, body.sortOrder ?? 0);

      const item = readItem(database, Number(result.lastInsertRowid));
      response.status(201).json({ item });
    })
  );

  router.patch(
    "/admin/menu/items/:itemId",
    requireStaffSession(database),
    validateBody(menuItemUpdateSchema),
    asyncHandler((request, response) => {
      const id = Number(request.params.itemId);
      assertPositiveId(id);

      const current = readItem(database, id);
      const body = request.body as {
        categoryId?: number;
        name?: string;
        pricePaise?: number;
        isVeg?: boolean;
        sortOrder?: number;
      };

      if (Object.keys(body).length === 0) {
        throw new AppError(400, "VALIDATION_ERROR", "No changes provided");
      }

      if (body.categoryId) {
        readCategory(database, body.categoryId);
      }

      database
        .prepare(
          `
            UPDATE menu_items
            SET
              category_id = ?,
              name = ?,
              price_paise = ?,
              is_veg = ?,
              sort_order = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `
        )
        .run(
          body.categoryId ?? current.categoryId,
          body.name ?? current.name,
          body.pricePaise ?? current.pricePaise,
          body.isVeg === undefined ? (current.isVeg ? 1 : 0) : body.isVeg ? 1 : 0,
          body.sortOrder ?? current.sortOrder,
          id
        );

      response.json({ item: readItem(database, id) });
    })
  );

  return router;
}

export function readMenu(database: Database) {
  const categories = database
    .prepare(
      `
        SELECT id, name, sort_order AS sortOrder
        FROM menu_categories
        ORDER BY sort_order ASC, name ASC
      `
    )
    .all() as MenuCategoryRow[];

  const items = database
    .prepare(
      `
        SELECT
          id,
          category_id AS categoryId,
          name,
          price_paise AS pricePaise,
          is_veg AS isVeg,
          sort_order AS sortOrder
        FROM menu_items
        ORDER BY sort_order ASC, name ASC
      `
    )
    .all() as Array<Omit<MenuItemRow, "isVeg"> & { isVeg: number }>[];

  const normalizedItems = items.map((item) => ({
    ...item,
    isVeg: Boolean(item.isVeg)
  }));

  const itemsByCategory = new Map<number, MenuItemRow[]>();

  for (const item of normalizedItems) {
    const group = itemsByCategory.get(item.categoryId) ?? [];
    group.push(item);
    itemsByCategory.set(item.categoryId, group);
  }

  return {
    categories: categories.map((category) => ({
      ...category,
      items: itemsByCategory.get(category.id) ?? []
    }))
  };
}

function readCategory(database: Database, id: number): MenuCategoryRow {
  const category = database
    .prepare(
      `
        SELECT id, name, sort_order AS sortOrder
        FROM menu_categories
        WHERE id = ?
      `
    )
    .get(id) as MenuCategoryRow | undefined;

  if (!category) {
    throw new AppError(404, "MENU_CATEGORY_NOT_FOUND", "Menu category not found");
  }

  return category;
}

function readItem(database: Database, id: number): MenuItemRow {
  const item = database
    .prepare(
      `
        SELECT
          id,
          category_id AS categoryId,
          name,
          price_paise AS pricePaise,
          is_veg AS isVeg,
          sort_order AS sortOrder
        FROM menu_items
        WHERE id = ?
      `
    )
    .get(id) as (Omit<MenuItemRow, "isVeg"> & { isVeg: number }) | undefined;

  if (!item) {
    throw new AppError(404, "MENU_ITEM_NOT_FOUND", "Menu item not found");
  }

  return {
    ...item,
    isVeg: Boolean(item.isVeg)
  };
}

function assertPositiveId(id: number): void {
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid identifier");
  }
}

