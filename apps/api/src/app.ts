import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  adminLoginSchema,
  createOrderSchema,
  customerLoginSchema,
  menuCategoryCreateSchema,
  menuCategoryUpdateSchema,
  menuItemCreateSchema,
  menuItemUpdateSchema,
  qrValidateRequestSchema,
  updateCartItemSchema
} from "@d3/shared";
import type { Env } from "./types.js";
import {
  createOpaqueToken,
  hashToken,
  verifyQrSignature,
  verifyPassword,
  hashPassword
} from "./security/crypto.js";
import {
  validateQrCode,
  createPreSession,
  getPreSession,
  getCustomerSession,
  authenticateCustomer,
  getStaffSession,
  getMenuTree,
  getOrCreateCart,
  setCartItem,
  clearCart,
  createOrderFromCart,
  getCustomerOrders,
  getOrderById,
  getAdminLiveOrders,
  markOrderPaid,
  markOrderCompleted
} from "./db/queries.js";

export const PRE_SESSION_COOKIE = "d3_pre_session";
export const CUSTOMER_SESSION_COOKIE = "d3_customer_session";
export const STAFF_SESSION_COOKIE = "d3_staff_session";

export function createHonoApp(injectedEnv?: Partial<Env>) {
  const app = new Hono<{ Bindings: Env }>();

  // If local Node or test environment injected, merge into c.env
  if (injectedEnv) {
    app.use("*", async (c, next) => {
      c.env = { ...injectedEnv, ...c.env };
      await next();
    });
  }

  // CORS Middleware
  app.use("*", async (c, next) => {
    const allowedOrigin = c.env.CORS_ORIGIN || "https://d3-restaurant.pages.dev";

    const corsMiddleware = cors({
      origin: (origin) => {
        if (!origin) return allowedOrigin;
        // Allow pages.dev subdomains, localhost during dev, or configured origin
        if (
          origin.endsWith(".pages.dev") ||
          origin.includes("localhost") ||
          origin.includes("127.0.0.1") ||
          origin === allowedOrigin
        ) {
          return origin;
        }
        return allowedOrigin;
      },
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key"]
    });

    return corsMiddleware(c, next);
  });

  // Global Error Handler
  app.onError((err, c) => {
    const isProduction = c.env.NODE_ENV === "production";
    console.error("API Error:", err);

    return c.json(
      {
        error: isProduction ? "An unexpected error occurred." : err.message
      },
      500
    );
  });

  // Helper for cookie options respecting secure flag
  function getCookieOptions(c: any, maxAgeSeconds: number) {
    const isProduction = c.env.NODE_ENV === "production";
    const secureCookies = isProduction || c.env.NODE_ENV !== "development";

    return {
      httpOnly: true,
      secure: secureCookies,
      sameSite: (secureCookies ? "None" : "Lax") as "None" | "Lax",
      path: "/",
      maxAge: maxAgeSeconds
    };
  }

  function clearCookie(c: any, cookieName: string) {
    const isProduction = c.env.NODE_ENV === "production";
    const secureCookies = isProduction || c.env.NODE_ENV !== "development";
    deleteCookie(c, cookieName, {
      path: "/",
      secure: secureCookies,
      sameSite: (secureCookies ? "None" : "Lax") as "None" | "Lax"
    });
  }

  function getAuthTokenFromContext(c: any, cookieName: string): string | null {
    const authHeader = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
    if (authHeader) return authHeader;
    return getCookie(c, cookieName) || null;
  }

  // Health check
  app.get("/", (c) =>
    c.json({ service: "d3-api", status: "ok", env: c.env.NODE_ENV ?? "production" })
  );
  app.get("/health", (c) => c.json({ ok: true, service: "D3 API" }));
  app.get("/api/health", (c) => c.json({ status: "ok" }));

  // -------------------------------------------------------------
  // 1. QR Validation
  // -------------------------------------------------------------
  app.post("/api/qr/validate", async (c) => {
    const rawBody = await c.req.json().catch(() => ({}));
    const parse = qrValidateRequestSchema.safeParse(rawBody);
    if (!parse.success) {
      return c.json({ error: "Invalid QR code" }, 400);
    }
    const { qrId, signature } = parse.data;

    const qrSecret = c.env.HMAC_SECRET;
    if (!qrSecret) {
      return c.json({ error: "QR validation is not configured" }, 500);
    }

    const isValid = verifyQrSignature(qrId, signature, qrSecret);
    if (!isValid) {
      return c.json({ error: "Invalid QR code" }, 400);
    }

    const qr = await validateQrCode(c.env.D3_DB, qrId);
    if (!qr) {
      return c.json({ error: "Invalid QR code" }, 404);
    }

    // Check if customer already has a session for a DIFFERENT table
    let existingSession: any = null;
    const currentToken = getAuthTokenFromContext(c, CUSTOMER_SESSION_COOKIE);
    if (currentToken) {
      const currentTokenHash = hashToken(currentToken);
      existingSession = await getCustomerSession(c.env.D3_DB, currentTokenHash);
      if (existingSession && existingSession.diningTableId !== qr.diningTableId) {
        await c.env.D3_DB
          .prepare("UPDATE customer_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?")
          .bind(currentTokenHash)
          .run();
        clearCookie(c, CUSTOMER_SESSION_COOKIE);
        existingSession = null;
      }
    }

    const sameTableSession = !!(
      existingSession && existingSession.diningTableId === qr.diningTableId
    );

    // Create pre-session token
    const token = createOpaqueToken();
    const tokenHash = hashToken(token);
    await createPreSession(c.env.D3_DB, qr.diningTableId, qr.id, tokenHash);

    setCookie(c, PRE_SESSION_COOKIE, token, getCookieOptions(c, 15 * 60));

    return c.json({
      token,
      table: { label: qr.tableLabel },
      tableLabel: qr.tableLabel,
      diningTableId: qr.diningTableId,
      sameTableSession
    });
  });

  // -------------------------------------------------------------
  // 2. Customer Authentication & Session
  // -------------------------------------------------------------
  async function handleGetSession(c: any) {
    const token = getAuthTokenFromContext(c, CUSTOMER_SESSION_COOKIE);
    if (!token) {
      return c.json({ error: "Unauthenticated" }, 401);
    }

    const session = await getCustomerSession(c.env.D3_DB, hashToken(token));
    if (!session) {
      clearCookie(c, CUSTOMER_SESSION_COOKIE);
      return c.json({ error: "Session expired or revoked" }, 401);
    }

    return c.json({
      customer: {
        id: session.customerId,
        name: session.customerName,
        mobileNumber: session.customerMobile
      },
      table: {
        id: session.diningTableId,
        label: session.tableLabel
      },
      session: {
        id: session.id,
        customer: {
          id: session.customerId,
          name: session.customerName,
          mobileNumber: session.customerMobile
        },
        table: {
          id: session.diningTableId,
          label: session.tableLabel
        }
      }
    });
  }

  app.get("/api/session", handleGetSession);
  app.get("/api/auth/customer/session", handleGetSession);

  async function handleCustomerLogin(c: any) {
    const preToken = getAuthTokenFromContext(c, PRE_SESSION_COOKIE);
    if (!preToken) {
      return c.json({ error: "Scan a valid table QR code first" }, 401);
    }

    const preSession = await getPreSession(c.env.D3_DB, hashToken(preToken));
    if (!preSession) {
      clearCookie(c, PRE_SESSION_COOKIE);
      return c.json({ error: "QR session expired. Scan a valid table QR code first" }, 401);
    }

    const rawBody = await c.req.json().catch(() => ({}));
    const parse = customerLoginSchema.safeParse(rawBody);
    if (!parse.success) {
      return c.json({ error: "Invalid name or mobile number" }, 400);
    }
    const { name, mobileNumber } = parse.data;

    const sessionToken = createOpaqueToken();
    const sessionTokenHash = hashToken(sessionToken);

    await authenticateCustomer(
      c.env.D3_DB,
      preSession.id,
      preSession.diningTableId,
      name,
      mobileNumber,
      sessionTokenHash
    );

    clearCookie(c, PRE_SESSION_COOKIE);
    setCookie(c, CUSTOMER_SESSION_COOKIE, sessionToken, getCookieOptions(c, 24 * 60 * 60));

    const session = await getCustomerSession(c.env.D3_DB, sessionTokenHash);
    return c.json({
      token: sessionToken,
      customer: {
        name: session!.customerName,
        mobileNumber: session!.customerMobile
      },
      table: {
        label: session!.tableLabel
      },
      session: {
        id: session!.id,
        customer: {
          id: session!.customerId,
          name: session!.customerName,
          mobileNumber: session!.customerMobile
        },
        table: {
          id: session!.diningTableId,
          label: session!.tableLabel
        }
      }
    });
  }

  app.post("/api/customer/login", handleCustomerLogin);
  app.post("/api/auth/customer/login", handleCustomerLogin);

  async function handleCustomerLogout(c: any) {
    clearCookie(c, CUSTOMER_SESSION_COOKIE);
    return c.json({ success: true });
  }

  app.post("/api/customer/logout", handleCustomerLogout);
  app.post("/api/auth/customer/logout", handleCustomerLogout);

  app.post("/api/auth/customer/request-otp", async (c) => {
    const preToken = getCookie(c, PRE_SESSION_COOKIE);
    if (!preToken) {
      return c.json({ error: "Scan a valid table QR code first" }, 401);
    }
    const preSession = await getPreSession(c.env.D3_DB, hashToken(preToken));
    if (!preSession) {
      return c.json({ error: "QR session expired" }, 401);
    }
    const challengeId = createOpaqueToken();
    const isDev = c.env.NODE_ENV !== "production";
    return c.json({
      challengeId,
      expiresInSeconds: 300,
      ...(isDev ? { devOtp: "123456" } : {})
    });
  });

  // -------------------------------------------------------------
  // 3. Menu
  // -------------------------------------------------------------
  app.get("/api/menu", async (c) => {
    const categories = await getMenuTree(c.env.D3_DB, false);
    return c.json({ categories });
  });

  // -------------------------------------------------------------
  // 4. Cart
  // -------------------------------------------------------------
  async function requireCustomer(c: any) {
    const token = getAuthTokenFromContext(c, CUSTOMER_SESSION_COOKIE);
    if (!token) return null;
    return getCustomerSession(c.env.D3_DB, hashToken(token));
  }

  app.get("/api/cart", async (c) => {
    const session = await requireCustomer(c);
    if (!session) {
      return c.json({ error: "Authentication required" }, 401);
    }
    const data = await getOrCreateCart(
      c.env.D3_DB,
      session.id,
      session.customerId,
      session.diningTableId
    );
    return c.json(data);
  });

  app.put("/api/cart/items", async (c) => {
    const session = await requireCustomer(c);
    if (!session) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const rawBody = await c.req.json().catch(() => ({}));
    const parse = updateCartItemSchema.safeParse(rawBody);
    if (!parse.success) {
      return c.json({ error: "Invalid item or quantity" }, 400);
    }
    const { menuItemId, quantity } = parse.data;

    const { cart } = await getOrCreateCart(
      c.env.D3_DB,
      session.id,
      session.customerId,
      session.diningTableId
    );

    await setCartItem(c.env.D3_DB, cart.id, menuItemId, quantity);

    const updated = await getOrCreateCart(
      c.env.D3_DB,
      session.id,
      session.customerId,
      session.diningTableId
    );
    return c.json(updated);
  });

  app.delete("/api/cart", async (c) => {
    const session = await requireCustomer(c);
    if (!session) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const { cart } = await getOrCreateCart(
      c.env.D3_DB,
      session.id,
      session.customerId,
      session.diningTableId
    );
    await clearCart(c.env.D3_DB, cart.id);

    const updated = await getOrCreateCart(
      c.env.D3_DB,
      session.id,
      session.customerId,
      session.diningTableId
    );
    return c.json(updated);
  });

  // -------------------------------------------------------------
  // 5. Orders (Customer)
  // -------------------------------------------------------------
  app.post("/api/orders", async (c) => {
    const session = await requireCustomer(c);
    if (!session) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const rawBody = await c.req.json().catch(() => ({}));
    // Rejects client-provided totals (schema is strict empty object)
    const parse = createOrderSchema.safeParse(rawBody);
    if (!parse.success) {
      return c.json({ error: "Invalid order payload" }, 400);
    }

    const idempotencyKey = c.req.header("Idempotency-Key") || undefined;

    try {
      const order = await createOrderFromCart(
        c.env.D3_DB,
        session.id,
        session.customerId,
        session.diningTableId,
        idempotencyKey
      );
      return c.json({ order }, 201);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Failed to place order" },
        400
      );
    }
  });

  async function handleGetCustomerOrders(c: any) {
    const session = await requireCustomer(c);
    if (!session) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const orders = await getCustomerOrders(
      c.env.D3_DB,
      session.id,
      session.customerId,
      session.diningTableId
    );
    return c.json({ orders });
  }

  app.get("/api/orders/current", handleGetCustomerOrders);
  app.get("/api/customer/orders", handleGetCustomerOrders);

  app.get("/api/orders/:orderId", async (c) => {
    const session = await requireCustomer(c);
    if (!session) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const orderId = Number(c.req.param("orderId"));
    const order = await getOrderById(c.env.D3_DB, orderId);
    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }

    return c.json({ order });
  });

  // -------------------------------------------------------------
  // 5b. Bug Reports & Beta Feedback (Dispatched to Telegram)
  // -------------------------------------------------------------
  app.post("/api/bug-reports", async (c) => {
    const rawBody = await c.req.json().catch(() => ({}));
    const message = typeof rawBody.message === "string" ? rawBody.message.trim() : "";
    if (!message) {
      return c.json({ error: "Message is required" }, 400);
    }

    const session = await requireCustomer(c).catch(() => null);
    const userAgent = c.req.header("User-Agent") || undefined;

    const customerName = session?.customerName ?? (typeof rawBody.customerName === "string" ? rawBody.customerName.trim() : null);
    const customerMobile = session?.customerMobile ?? (typeof rawBody.customerMobile === "string" ? rawBody.customerMobile.trim() : null);
    const tableLabel = session?.tableLabel ?? (typeof rawBody.tableLabel === "string" ? rawBody.tableLabel.trim() : null);
    const screen = typeof rawBody.screen === "string" ? rawBody.screen.trim() : null;

    const botToken = c.env.TELEGRAM_BOT_TOKEN;
    const chatId = c.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.warn("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured; report received but not delivered to Telegram");
      return c.json({ success: true, delivered: false });
    }

    const escapeHtml = (text: string) =>
      text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const lines = [
      `<b>D3 Beta Bug Report</b>`,
      ``,
      `<b>Feedback:</b> ${escapeHtml(message)}`,
      `<b>Screen:</b> ${screen ? escapeHtml(screen) : "N/A"}`,
      `<b>Table:</b> ${tableLabel ? escapeHtml(tableLabel) : "N/A"}`,
      `<b>Customer:</b> ${customerName ? escapeHtml(customerName) : "Anonymous"}${customerMobile ? ` (${escapeHtml(customerMobile)})` : ""}`,
      `🌐 <b>User Agent:</b> ${userAgent ? escapeHtml(userAgent) : "N/A"}`
    ];

    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: lines.join("\n"),
          parse_mode: "HTML"
        })
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error("Telegram API error:", response.status, errorText);
        return c.json({ success: false, error: "Telegram dispatch failed" }, 502);
      }

      return c.json({ success: true, delivered: true });
    } catch (err) {
      console.error("Failed to forward bug report to Telegram:", err);
      return c.json({ success: false, error: "Internal Telegram dispatch error" }, 500);
    }
  });

  // -------------------------------------------------------------
  // 6. Admin Authentication & Dashboard
  // -------------------------------------------------------------
  async function requireStaff(c: any) {
    const token = getAuthTokenFromContext(c, STAFF_SESSION_COOKIE);
    if (!token) return null;
    return getStaffSession(c.env.D3_DB, hashToken(token));
  }

  app.post("/api/admin/login", async (c) => {
    const rawBody = await c.req.json().catch(() => ({}));
    const parse = adminLoginSchema.safeParse(rawBody);
    if (!parse.success) {
      return c.json({ error: "Invalid credentials" }, 400);
    }
    const { username, password } = parse.data;

    const user = await c.env.D3_DB
      .prepare(`SELECT id, username, password_hash FROM staff_users WHERE username = ?`)
      .bind(username)
      .first<{ id: number; username: string; password_hash: string }>();

    if (!user || !verifyPassword(password, user.password_hash)) {
      return c.json({ error: "Invalid username or password" }, 401);
    }

    const sessionToken = createOpaqueToken();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

    await c.env.D3_DB
      .prepare(
        `
        INSERT INTO staff_sessions (token_hash, staff_user_id, expires_at)
        VALUES (?, ?, ?)
        `
      )
      .bind(hashToken(sessionToken), user.id, expiresAt)
      .run();

    setCookie(c, STAFF_SESSION_COOKIE, sessionToken, getCookieOptions(c, 12 * 60 * 60));

    return c.json({
      token: sessionToken,
      staff: {
        id: user.id,
        username: user.username
      }
    });
  });

  app.get("/api/admin/session", async (c) => {
    const staff = await requireStaff(c);
    if (!staff) {
      return c.json({ error: "Unauthenticated" }, 401);
    }
    return c.json({
      staff: {
        id: staff.staffUserId,
        username: staff.username
      }
    });
  });

  app.post("/api/admin/logout", (c) => {
    clearCookie(c, STAFF_SESSION_COOKIE);
    return c.json({ success: true });
  });

  app.post("/api/admin/change-password", async (c) => {
    const staff = await requireStaff(c);
    if (!staff) {
      return c.json({ error: "Unauthenticated" }, 401);
    }

    const rawBody = await c.req.json().catch(() => ({}));
    const { currentPassword, newPassword, newUsername } = rawBody;

    if (!currentPassword || !newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return c.json({ error: "New password must be at least 6 characters long" }, 400);
    }

    const user = await c.env.D3_DB
      .prepare(`SELECT id, username, password_hash FROM staff_users WHERE id = ?`)
      .bind(staff.staffUserId)
      .first<{ id: number; username: string; password_hash: string }>();

    if (!user || !verifyPassword(currentPassword, user.password_hash)) {
      return c.json({ error: "Current password is incorrect" }, 401);
    }

    const updatedUsername =
      newUsername && typeof newUsername === "string" && newUsername.trim()
        ? newUsername.trim()
        : user.username;
    const newHash = hashPassword(newPassword);

    await c.env.D3_DB
      .prepare(`UPDATE staff_users SET username = ?, password_hash = ? WHERE id = ?`)
      .bind(updatedUsername, newHash, staff.staffUserId)
      .run();

    return c.json({ success: true, username: updatedUsername });
  });

  // Admin Live Orders (Strict FIFO order: earliest orders first, new at bottom)
  app.get("/api/admin/orders", async (c) => {
    const staff = await requireStaff(c);
    if (!staff) {
      return c.json({ error: "Unauthenticated" }, 401);
    }

    const orders = await getAdminLiveOrders(c.env.D3_DB);
    return c.json({ orders });
  });

  app.get("/api/admin/orders/:orderId", async (c) => {
    const staff = await requireStaff(c);
    if (!staff) {
      return c.json({ error: "Unauthenticated" }, 401);
    }

    const orderId = Number(c.req.param("orderId"));
    const order = await getOrderById(c.env.D3_DB, orderId);
    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }

    return c.json({ order });
  });

  app.post("/api/admin/orders/:orderId/mark-paid-offline", async (c) => {
    const staff = await requireStaff(c);
    if (!staff) {
      return c.json({ error: "Unauthenticated" }, 401);
    }

    const orderId = Number(c.req.param("orderId"));
    const order = await markOrderPaid(c.env.D3_DB, orderId, staff.staffUserId);
    return c.json({ order });
  });

  app.post("/api/admin/orders/:orderId/mark-completed", async (c) => {
    const staff = await requireStaff(c);
    if (!staff) {
      return c.json({ error: "Unauthenticated" }, 401);
    }

    const orderId = Number(c.req.param("orderId"));
    const order = await markOrderCompleted(c.env.D3_DB, orderId, staff.staffUserId);
    return c.json({ order });
  });

  // Admin Menu Management
  app.get("/api/admin/menu", async (c) => {
    const staff = await requireStaff(c);
    if (!staff) {
      return c.json({ error: "Unauthenticated" }, 401);
    }

    const categories = await getMenuTree(c.env.D3_DB, true);
    return c.json({ categories });
  });

  app.post("/api/admin/menu/categories", async (c) => {
    const staff = await requireStaff(c);
    if (!staff) return c.json({ error: "Unauthenticated" }, 401);

    const rawBody = await c.req.json().catch(() => ({}));
    const parse = menuCategoryCreateSchema.safeParse(rawBody);
    if (!parse.success) return c.json({ error: "Valid category name required" }, 400);
    const { name, sortOrder } = parse.data;

    const countRow = await c.env.D3_DB
      .prepare(`SELECT COUNT(*) AS total FROM menu_categories`)
      .first<{ total: number }>();
    const order = sortOrder ?? (countRow?.total ?? 0) + 1;

    const res = await c.env.D3_DB
      .prepare(`INSERT INTO menu_categories (name, sort_order) VALUES (?, ?)`)
      .bind(name, order)
      .run();

    return c.json(
      { category: { id: res.meta.last_row_id, name, sortOrder: order, active: true, items: [] } },
      201
    );
  });

  app.patch("/api/admin/menu/categories/:categoryId", async (c) => {
    const staff = await requireStaff(c);
    if (!staff) return c.json({ error: "Unauthenticated" }, 401);

    const id = Number(c.req.param("categoryId"));
    const rawBody = await c.req.json().catch(() => ({}));
    const parse = menuCategoryUpdateSchema.safeParse(rawBody);
    if (!parse.success) return c.json({ error: "Invalid category update" }, 400);

    if (parse.data.name !== undefined) {
      await c.env.D3_DB
        .prepare(`UPDATE menu_categories SET name = ? WHERE id = ?`)
        .bind(parse.data.name, id)
        .run();
    }

    const category = await c.env.D3_DB
      .prepare(
        `SELECT id, name, sort_order AS sortOrder, active FROM menu_categories WHERE id = ?`
      )
      .bind(id)
      .first();

    return c.json({ category });
  });

  app.delete("/api/admin/menu/categories/:categoryId", async (c) => {
    const staff = await requireStaff(c);
    if (!staff) return c.json({ error: "Unauthenticated" }, 401);

    const id = Number(c.req.param("categoryId"));
    await c.env.D3_DB.batch([
      c.env.D3_DB.prepare(`DELETE FROM menu_items WHERE category_id = ?`).bind(id),
      c.env.D3_DB.prepare(`DELETE FROM menu_categories WHERE id = ?`).bind(id)
    ]);

    return c.json({ success: true });
  });

  app.post("/api/admin/menu/items", async (c) => {
    const staff = await requireStaff(c);
    if (!staff) return c.json({ error: "Unauthenticated" }, 401);

    const rawBody = await c.req.json().catch(() => ({}));
    const parse = menuItemCreateSchema.safeParse(rawBody);
    if (!parse.success) return c.json({ error: "Invalid item details" }, 400);
    const { categoryId, name, pricePaise, isVeg, sortOrder } = parse.data;

    const res = await c.env.D3_DB
      .prepare(
        `INSERT INTO menu_items (category_id, name, price_paise, is_veg, sort_order) VALUES (?, ?, ?, ?, ?)`
      )
      .bind(categoryId, name, pricePaise, isVeg ? 1 : 0, sortOrder ?? 1)
      .run();

    return c.json(
      {
        item: {
          id: res.meta.last_row_id,
          categoryId,
          name,
          pricePaise,
          isVeg,
          active: true,
          sortOrder: sortOrder ?? 1
        }
      },
      201
    );
  });

  app.patch("/api/admin/menu/items/:itemId", async (c) => {
    const staff = await requireStaff(c);
    if (!staff) return c.json({ error: "Unauthenticated" }, 401);

    const id = Number(c.req.param("itemId"));
    const rawBody = await c.req.json().catch(() => ({}));
    const parse = menuItemUpdateSchema.safeParse(rawBody);
    if (!parse.success) return c.json({ error: "Invalid item update" }, 400);

    if (parse.data.name !== undefined) {
      await c.env.D3_DB
        .prepare(`UPDATE menu_items SET name = ? WHERE id = ?`)
        .bind(parse.data.name, id)
        .run();
    }
    if (parse.data.pricePaise !== undefined) {
      await c.env.D3_DB
        .prepare(`UPDATE menu_items SET price_paise = ? WHERE id = ?`)
        .bind(parse.data.pricePaise, id)
        .run();
    }
    if (parse.data.isVeg !== undefined) {
      await c.env.D3_DB
        .prepare(`UPDATE menu_items SET is_veg = ? WHERE id = ?`)
        .bind(parse.data.isVeg ? 1 : 0, id)
        .run();
    }

    const item = await c.env.D3_DB
      .prepare(
        `SELECT id, category_id AS categoryId, name, price_paise AS pricePaise, is_veg AS isVeg, active FROM menu_items WHERE id = ?`
      )
      .bind(id)
      .first();

    return c.json({ item });
  });

  app.delete("/api/admin/menu/items/:itemId", async (c) => {
    const staff = await requireStaff(c);
    if (!staff) return c.json({ error: "Unauthenticated" }, 401);

    const id = Number(c.req.param("itemId"));
    await c.env.D3_DB.prepare(`DELETE FROM menu_items WHERE id = ?`).bind(id).run();
    return c.json({ success: true });
  });

  return app;
}

export const defaultApp = createHonoApp();
export default defaultApp;
