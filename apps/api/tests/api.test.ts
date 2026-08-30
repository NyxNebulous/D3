import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestConfig, type AppConfig } from "../src/config/env.js";
import { openDatabase, type Database } from "../src/db/database.js";
import { runMigrations } from "../src/db/migrations.js";
import { createApp } from "../src/app/createApp.js";
import { resetRateLimitsForTests } from "../src/middleware/rateLimit.js";
import { hashPassword, signQrId } from "../src/security/crypto.js";

type TestServer = {
  config: AppConfig;
  database: Database;
  app: ReturnType<typeof createApp>;
  qrId: string;
  qrSignature: string;
  menuItemId: number;
};

describe("D3 API V1", () => {
  beforeEach(() => {
    resetRateLimitsForTests();
  });

  afterEach(() => {
    resetRateLimitsForTests();
  });

  it("rejects QR signature tampering before establishing table context", async () => {
    const server = createTestServer();
    const agent = request.agent(server.app);

    await agent
      .post("/api/qr/validate")
      .send({ qrId: server.qrId, signature: "0".repeat(64) })
      .expect(400);

    const response = await agent
      .post("/api/qr/validate")
      .send({ qrId: server.qrId, signature: server.qrSignature })
      .expect(200);

    expect(response.body.table).toEqual({ label: "Table 7" });
  });

  it("creates orders with server-derived totals and offline V1 states", async () => {
    const server = createTestServer();
    const agent = request.agent(server.app);

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
    const agent = request.agent(server.app);

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

  it("keeps payment and fulfillment changes staff-authorized and sequential", async () => {
    const server = createTestServer();
    const customerAgent = request.agent(server.app);
    const adminAgent = request.agent(server.app);

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

    await adminAgent.post(`/api/admin/orders/${orderId}/mark-completed`).send({}).expect(409);

    const paid = await adminAgent
      .post(`/api/admin/orders/${orderId}/mark-paid-offline`)
      .send({})
      .expect(200);

    expect(paid.body.order.paymentState).toBe("PAID_OFFLINE");
    expect(paid.body.order.fulfillmentState).toBe("PENDING");

    const completed = await adminAgent
      .post(`/api/admin/orders/${orderId}/mark-completed`)
      .send({})
      .expect(200);

    expect(completed.body.order.paymentState).toBe("PAID_OFFLINE");
    expect(completed.body.order.fulfillmentState).toBe("COMPLETED");
  });

  it("supports veg and non-veg menu metadata", async () => {
    const server = createTestServer();
    const adminAgent = request.agent(server.app);

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
  });

  it("invalidates a customer session when they scan a different table QR", async () => {
    const server = createTestServer();
    const agent = request.agent(server.app);

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
      .post("/api/auth/customer/request-otp")
      .send({ name: "Asha", mobileNumber: "+919876543210" })
      .expect(200);
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

    const agent = request.agent(createApp(database, config));

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

  return {
    config,
    database,
    app: createApp(database, config),
    qrId,
    qrSignature: signQrId(qrId, config.qrSecret),
    menuItemId: Number(item.lastInsertRowid)
  };
}

async function authenticateCustomer(
  server: TestServer,
  agent: ReturnType<typeof request.agent>
): Promise<void> {
  await agent
    .post("/api/qr/validate")
    .send({ qrId: server.qrId, signature: server.qrSignature })
    .expect(200);

  const otpResponse = await agent
    .post("/api/auth/customer/request-otp")
    .send({ name: "Asha", mobileNumber: "+919876543210" })
    .expect(200);

  await agent
    .post("/api/auth/customer/verify-otp")
    .send({
      challengeId: otpResponse.body.challengeId,
      otp: otpResponse.body.devOtp
    })
    .expect(200);
}

