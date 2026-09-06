import { describe, expect, it } from "vitest";
import { createTestConfig, type AppConfig } from "../src/config/env.js";
import { openDatabase, createSqliteD1Adapter, type Database } from "../src/db/database.js";
import { runMigrations } from "../src/db/migrations.js";
import { createHonoApp } from "../src/app.js";
import { hashPassword, signQrId } from "../src/security/crypto.js";

type TestServer = {
  config: AppConfig;
  database: Database;
  app: ReturnType<typeof createHonoApp>;
  qrId: string;
  qrSignature: string;
  menuItemId: number;
};

type TestResponse = {
  status: number;
  body: any;
  headers: Headers;
};

type RequestBuilder = {
  set(key: string, value: string): RequestBuilder;
  send(body: any): RequestBuilder;
  expect(expectedStatus: number): Promise<TestResponse>;
  then<TResult1 = TestResponse, TResult2 = never>(
    onfulfilled?: ((value: TestResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2>;
};

class HonoTestAgent {
  private cookies = new Map<string, string>();

  constructor(private app: ReturnType<typeof createHonoApp>) {}

  private createRequest(method: string, path: string): RequestBuilder {
    const headers: Record<string, string> = {};
    let bodyPayload: any = undefined;

    const execute = async (expectedStatus?: number): Promise<TestResponse> => {
      if (this.cookies.size > 0) {
        const cookieHeader = Array.from(this.cookies.entries())
          .map(([k, v]) => `${k}=${v}`)
          .join("; ");
        headers["cookie"] = cookieHeader;
      }

      let bodyInit: string | undefined = undefined;
      if (bodyPayload !== undefined) {
        bodyInit = JSON.stringify(bodyPayload);
        if (!headers["content-type"]) {
          headers["content-type"] = "application/json";
        }
      }

      const res = await this.app.request(path, {
        method,
        headers,
        body: bodyInit
      });

      // Capture cookies
      const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      if (setCookies.length > 0) {
        for (const sc of setCookies) {
          const [pair] = sc.split(";");
          const eq = pair.indexOf("=");
          if (eq !== -1) {
            const k = pair.substring(0, eq).trim();
            const v = pair.substring(eq + 1).trim();
            if (v === "" || sc.includes("Max-Age=0") || sc.includes("Expires=Thu, 01 Jan 1970")) {
              this.cookies.delete(k);
            } else {
              this.cookies.set(k, v);
            }
          }
        }
      } else {
        const raw = res.headers.get("set-cookie");
        if (raw) {
          for (const part of raw.split(/,(?=[^;]+=[^;]+)/)) {
            const [pair] = part.split(";");
            const eq = pair.indexOf("=");
            if (eq !== -1) {
              const k = pair.substring(0, eq).trim();
              const v = pair.substring(eq + 1).trim();
              if (v === "" || part.includes("Max-Age=0") || part.includes("Expires=Thu, 01 Jan 1970")) {
                this.cookies.delete(k);
              } else {
                this.cookies.set(k, v);
              }
            }
          }
        }
      }

      const text = await res.text();
      let parsedBody: any = null;
      try {
        parsedBody = JSON.parse(text);
      } catch {
        parsedBody = text;
      }

      if (expectedStatus !== undefined && res.status !== expectedStatus) {
        throw new Error(
          `Expected status ${expectedStatus} but got ${res.status}. Body: ${JSON.stringify(parsedBody)}`
        );
      }

      return {
        status: res.status,
        body: parsedBody,
        headers: res.headers
      };
    };

    const builder: RequestBuilder = {
      set(key: string, value: string) {
        headers[key.toLowerCase()] = value;
        return builder;
      },
      send(body: any) {
        bodyPayload = body;
        return builder;
      },
      expect(expectedStatus: number) {
        return execute(expectedStatus);
      },
      then(onfulfilled, onrejected) {
        return execute(200).then(onfulfilled, onrejected);
      }
    };

    return builder;
  }

  get(path: string) {
    return this.createRequest("GET", path);
  }

  post(path: string) {
    return this.createRequest("POST", path);
  }

  put(path: string) {
    return this.createRequest("PUT", path);
  }

  delete(path: string) {
    return this.createRequest("DELETE", path);
  }
}

describe("D3 API V1 (Hono Unified Backend)", () => {
  it("rejects QR signature tampering before establishing table context", async () => {
    const server = createTestServer();
    const agent = new HonoTestAgent(server.app);

    await agent
      .post("/api/qr/validate")
      .send({ qrId: server.qrId, signature: "0".repeat(64) })
      .expect(400);

    await agent
      .post("/api/qr/validate")
      .send({
        qrId: server.qrId,
        signature: signQrId(server.qrId, "d3-production-qr-secret-replace-with-yours")
      })
      .expect(400);

    const response = await agent
      .post("/api/qr/validate")
      .send({ qrId: server.qrId, signature: server.qrSignature })
      .expect(200);

    expect(response.body.table).toEqual({ label: "Table 7" });
  });

  it("creates orders with server-derived totals and offline V1 states", async () => {
    const server = createTestServer();
    const agent = new HonoTestAgent(server.app);

    await authenticateCustomer(server, agent);

    await agent
      .put("/api/cart/items")
      .send({ menuItemId: server.menuItemId, quantity: 2 })
      .expect(200);

    await agent
      .post("/api/orders")
      .set("Idempotency-Key", "order-rejects-client-total")
      .send({ totalPaise: 1 })
      .expect(400);

    const response = await agent
      .post("/api/orders")
      .set("Idempotency-Key", "order-server-total")
      .send({})
      .expect(201);

    expect(response.body.order.totalPaise).toBe(25000);
    expect(response.body.order.paymentState).toBe("UNPAID");
    expect(response.body.order.fulfillmentState).toBe("PENDING");
    expect(response.body.order.items).toEqual([
      expect.objectContaining({
        itemName: "Fixture Item",
        quantity: 2,
        unitPricePaise: 12500,
        lineTotalPaise: 25000
      })
    ]);
  });

  it("does not allow a customer session to mark offline payment", async () => {
    const server = createTestServer();
    const agent = new HonoTestAgent(server.app);

    await authenticateCustomer(server, agent);
    await agent
      .put("/api/cart/items")
      .send({ menuItemId: server.menuItemId, quantity: 1 })
      .expect(200);

    const orderResponse = await agent
      .post("/api/orders")
      .set("Idempotency-Key", "customer-cannot-pay")
      .send({})
      .expect(201);

    await agent
      .post(`/api/admin/orders/${orderResponse.body.order.id}/mark-paid-offline`)
      .send({})
      .expect(401);
  });

  it("allows staff to mark orders prepared and paid independently", async () => {
    const server = createTestServer();
    const customerAgent = new HonoTestAgent(server.app);
    const adminAgent = new HonoTestAgent(server.app);

    await authenticateCustomer(server, customerAgent);
    await customerAgent
      .put("/api/cart/items")
      .send({ menuItemId: server.menuItemId, quantity: 1 })
      .expect(200);

    const orderResponse = await customerAgent
      .post("/api/orders")
      .set("Idempotency-Key", "admin-updates-order")
      .send({})
      .expect(201);
    const orderId = orderResponse.body.order.id as number;

    await adminAgent
      .post("/api/admin/login")
      .send({ username: "manager", password: "manager-password" })
      .expect(200);

    const completed = await adminAgent
      .post(`/api/admin/orders/${orderId}/mark-completed`)
      .send({})
      .expect(200);

    expect(completed.body.order.paymentState).toBe("UNPAID");
    expect(completed.body.order.fulfillmentState).toBe("COMPLETED");

    const paid = await adminAgent
      .post(`/api/admin/orders/${orderId}/mark-paid-offline`)
      .send({})
      .expect(200);

    expect(paid.body.order.paymentState).toBe("PAID_OFFLINE");
    expect(paid.body.order.fulfillmentState).toBe("COMPLETED");
  });

  it("returns admin orders in FIFO sequence (earliest orders first, new orders at bottom)", async () => {
    const server = createTestServer();
    const customerAgent = new HonoTestAgent(server.app);
    const adminAgent = new HonoTestAgent(server.app);

    await authenticateCustomer(server, customerAgent);
    await customerAgent
      .put("/api/cart/items")
      .send({ menuItemId: server.menuItemId, quantity: 1 })
      .expect(200);

    const order1 = await customerAgent
      .post("/api/orders")
      .set("Idempotency-Key", "order-fifo-1")
      .send({})
      .expect(201);

    await customerAgent
      .put("/api/cart/items")
      .send({ menuItemId: server.menuItemId, quantity: 2 })
      .expect(200);

    const order2 = await customerAgent
      .post("/api/orders")
      .set("Idempotency-Key", "order-fifo-2")
      .send({})
      .expect(201);

    await adminAgent
      .post("/api/admin/login")
      .send({ username: "manager", password: "manager-password" })
      .expect(200);

    const adminOrders = await adminAgent.get("/api/admin/orders").expect(200);
    const orderIds = adminOrders.body.orders.map((o: { id: number }) => o.id);

    const idx1 = orderIds.indexOf(order1.body.order.id);
    const idx2 = orderIds.indexOf(order2.body.order.id);

    expect(idx1).toBeGreaterThanOrEqual(0);
    expect(idx2).toBeGreaterThanOrEqual(0);
    expect(idx1).toBeLessThan(idx2); // Earlier order appears BEFORE newer order
  });

  it("supports veg and non-veg menu metadata", async () => {
    const server = createTestServer();
    const adminAgent = new HonoTestAgent(server.app);

    await adminAgent.post("/api/admin/login").send({ username: "manager", password: "manager-password" }).expect(200);

    const category = await adminAgent
      .post("/api/admin/menu/categories")
      .send({ name: "Mains" })
      .expect(201);

    const item = await adminAgent
      .post("/api/admin/menu/items")
      .send({
        categoryId: category.body.category.id,
        name: "Paneer Tikka",
        pricePaise: 17900,
        isVeg: true
      })
      .expect(201);

    expect(item.body.item.isVeg).toBe(true);

    const menu = await adminAgent.get("/api/admin/menu").expect(200);
    expect(menu.body.categories.some((categoryRow: any) => categoryRow.name === "Mains")).toBe(true);
    expect(menu.body.categories.flatMap((categoryRow: any) => categoryRow.items).some((entry: any) => entry.name === "Paneer Tikka" && entry.isVeg === true)).toBe(true);

    await adminAgent.delete(`/api/admin/menu/items/${item.body.item.id}`).expect(200);
    await adminAgent.delete(`/api/admin/menu/categories/${category.body.category.id}`).expect(200);
  });

  it("invalidates a customer session when they scan a different table QR", async () => {
    const server = createTestServer();
    const agent = new HonoTestAgent(server.app);

    await authenticateCustomer(server, agent);

    const otherTable = server.database
      .prepare("INSERT INTO dining_tables (label) VALUES (?)")
      .run("Table 9");
    const otherTableId = Number(otherTable.lastInsertRowid);
    const otherQrId = "table-9";

    server.database
      .prepare("INSERT INTO table_qr_codes (qr_identifier, dining_table_id) VALUES (?, ?)")
      .run(otherQrId, otherTableId);

    await agent
      .post("/api/qr/validate")
      .send({ qrId: otherQrId, signature: signQrId(otherQrId, server.config.qrSecret) })
      .expect(200);

    await agent.get("/api/auth/customer/session").expect(401);

    await agent
      .post("/api/auth/customer/login")
      .send({ name: "Asha", mobileNumber: "+919876543210" })
      .expect(200);
  });

  it("shows previous orders from different tables when user scans and logs into another table", async () => {
    const server = createTestServer();
    const agent = new HonoTestAgent(server.app);

    // 1. Asha authenticates at Table 7
    await authenticateCustomer(server, agent);

    // 2. Asha places an order at Table 7
    await agent
      .put("/api/cart/items")
      .send({ menuItemId: server.menuItemId, quantity: 2 })
      .expect(200);

    const order1 = await agent
      .post("/api/orders")
      .send({})
      .expect(201);

    expect(order1.body.order.tableLabel).toBe("Table 7");

    // 3. Asha moves and scans Table 9
    const otherTable = server.database
      .prepare("INSERT INTO dining_tables (label) VALUES (?)")
      .run("Table 9");
    const otherTableId = Number(otherTable.lastInsertRowid);
    const otherQrId = "table-9";

    server.database
      .prepare("INSERT INTO table_qr_codes (qr_identifier, dining_table_id) VALUES (?, ?)")
      .run(otherQrId, otherTableId);

    await agent
      .post("/api/qr/validate")
      .send({ qrId: otherQrId, signature: signQrId(otherQrId, server.config.qrSecret) })
      .expect(200);

    // 4. Asha logs into Table 9 with the same mobile number
    await agent
      .post("/api/auth/customer/login")
      .send({ name: "Asha", mobileNumber: "+919876543210" })
      .expect(200);

    // 5. Previous order from Table 7 must be visible in orders section!
    const table9OrdersRes = await agent.get("/api/orders/current").expect(200);
    expect(table9OrdersRes.body.orders).toHaveLength(1);
    expect(table9OrdersRes.body.orders[0].id).toBe(order1.body.order.id);
    expect(table9OrdersRes.body.orders[0].tableLabel).toBe("Table 7");

    // 6. Asha places a new order at Table 9
    await agent
      .put("/api/cart/items")
      .send({ menuItemId: server.menuItemId, quantity: 1 })
      .expect(200);

    const order2 = await agent
      .post("/api/orders")
      .send({})
      .expect(201);

    expect(order2.body.order.tableLabel).toBe("Table 9");

    // 7. Both orders from Table 9 and Table 7 must be visible in orders section!
    const allOrdersRes = await agent.get("/api/orders/current").expect(200);
    expect(allOrdersRes.body.orders).toHaveLength(2);
    expect(allOrdersRes.body.orders[0].id).toBe(order2.body.order.id);
    expect(allOrdersRes.body.orders[0].tableLabel).toBe("Table 9");
    expect(allOrdersRes.body.orders[1].id).toBe(order1.body.order.id);
    expect(allOrdersRes.body.orders[1].tableLabel).toBe("Table 7");
  });

  it("authenticates a customer directly with name and mobile number after table QR validation", async () => {
    const server = createTestServer();
    const agent = new HonoTestAgent(server.app);

    // Rejects before QR scan
    await agent
      .post("/api/auth/customer/login")
      .send({ name: "Ravi", mobileNumber: "+919876543210" })
      .expect(401);

    // Validates QR
    await agent
      .post("/api/qr/validate")
      .send({ qrId: server.qrId, signature: server.qrSignature })
      .expect(200);

    // Logs in directly
    const loginResponse = await agent
      .post("/api/auth/customer/login")
      .send({ name: "Ravi", mobileNumber: "+919876543210" })
      .expect(200);

    expect(loginResponse.body.customer).toEqual({
      name: "Ravi",
      mobileNumber: "+919876543210"
    });
    expect(loginResponse.body.table).toEqual({ label: "Table 7" });

    // Session is active
    const sessionResponse = await agent.get("/api/auth/customer/session").expect(200);
    expect(sessionResponse.body.customer.name).toBe("Ravi");
  });

  it("never includes devOtp in production responses", async () => {
    const config = createTestConfig({ nodeEnv: "production" });
    const database = openDatabase(config.databasePath);
    runMigrations(database);

    const table = database.prepare("INSERT INTO dining_tables (label) VALUES (?)").run("Table 7");
    const qrId = "prod-otp-check";

    database
      .prepare("INSERT INTO table_qr_codes (qr_identifier, dining_table_id) VALUES (?, ?)")
      .run(qrId, Number(table.lastInsertRowid));

    const d1Database = createSqliteD1Adapter(database);
    const app = createHonoApp({
      D3_DB: d1Database,
      HMAC_SECRET: config.qrSecret,
      SESSION_SECRET: config.sessionSecret,
      CORS_ORIGIN: config.corsOrigin,
      NODE_ENV: "production"
    });

    const agent = new HonoTestAgent(app);

    await agent
      .post("/api/qr/validate")
      .send({ qrId, signature: signQrId(qrId, config.qrSecret) })
      .expect(200);

    const otpResponse = await agent
      .post("/api/auth/customer/request-otp")
      .send({ name: "Asha", mobileNumber: "+919876543210" })
      .expect(200);

    expect(otpResponse.body).not.toHaveProperty("devOtp");
  });
});

function createTestServer(): TestServer {
  const config = createTestConfig();
  const database = openDatabase(config.databasePath);
  runMigrations(database);

  const table = database.prepare("INSERT INTO dining_tables (label) VALUES (?)").run("Table 7");
  const tableId = Number(table.lastInsertRowid);
  const qrId = "fixture-table-7";

  database
    .prepare("INSERT INTO table_qr_codes (qr_identifier, dining_table_id) VALUES (?, ?)")
    .run(qrId, tableId);

  const category = database
    .prepare("INSERT INTO menu_categories (name, sort_order) VALUES (?, ?)")
    .run("Fixture", 0);
  const item = database
    .prepare(
      `
        INSERT INTO menu_items (category_id, name, price_paise, sort_order)
        VALUES (?, ?, ?, ?)
      `
    )
    .run(Number(category.lastInsertRowid), "Fixture Item", 12500, 0);

  database
    .prepare("INSERT INTO staff_users (username, password_hash) VALUES (?, ?)")
    .run("manager", hashPassword("manager-password"));

  const d1Database = createSqliteD1Adapter(database);
  const app = createHonoApp({
    D3_DB: d1Database,
    HMAC_SECRET: config.qrSecret,
    SESSION_SECRET: config.sessionSecret,
    CORS_ORIGIN: config.corsOrigin,
    NODE_ENV: config.nodeEnv
  });

  return {
    config,
    database,
    app,
    qrId,
    qrSignature: signQrId(qrId, config.qrSecret),
    menuItemId: Number(item.lastInsertRowid)
  };
}

async function authenticateCustomer(
  server: TestServer,
  agent: HonoTestAgent
): Promise<void> {
  await agent
    .post("/api/qr/validate")
    .send({ qrId: server.qrId, signature: server.qrSignature })
    .expect(200);

  await agent
    .post("/api/auth/customer/login")
    .send({ name: "Asha", mobileNumber: "+919876543210" })
    .expect(200);
}


