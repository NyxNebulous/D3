import request from "supertest";
import express from "express";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createTestConfig } from "../src/config/env.js";
import { openDatabase, type Database } from "../src/db/database.js";
import { transaction } from "../src/db/database.js";
import { runMigrations } from "../src/db/migrations.js";
import { createApp } from "../src/app/createApp.js";
import { createErrorHandler } from "../src/middleware/errors.js";
import { createOriginGuard } from "../src/middleware/originGuard.js";
import { validateBody } from "../src/middleware/requestValidation.js";

describe("D3 API foundation", () => {
  it("serves a minimal health endpoint backed by SQLite", async () => {
    const { app } = createFoundationServer();

    const response = await request(app).get("/health").expect(200);

    expect(response.body).toEqual({ ok: true, service: "D3 API" });
  });

  it("creates the migration ledger without business tables", () => {
    const database = openDatabase(":memory:");

    runMigrations(database);

    const migrationTable = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
      .get();
    const businessTable = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'orders'")
      .get();

    expect(migrationTable).toEqual({ name: "schema_migrations" });
    expect(businessTable).toBeUndefined();
  });

  it("rolls back failed transactions", () => {
    const database = openDatabase(":memory:");
    database.exec("CREATE TABLE transaction_smoke (id INTEGER PRIMARY KEY, label TEXT NOT NULL);");

    expect(() =>
      transaction(database, () => {
        database.prepare("INSERT INTO transaction_smoke (label) VALUES (?)").run("rolled-back");
        throw new Error("stop");
      })
    ).toThrow("stop");

    const rows = database.prepare("SELECT label FROM transaction_smoke").all();
    expect(rows).toEqual([]);
  });

  it("returns a safe validation error response", async () => {
    const config = createTestConfig();
    const app = express();

    app.use(express.json());
    app.post(
      "/validate",
      validateBody(z.object({ name: z.string().min(1) }).strict()),
      (request, response) => {
        response.json(request.body);
      }
    );
    app.use(createErrorHandler(config));

    const response = await request(app).post("/validate").send({ name: "" }).expect(400);

    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request"
      }
    });
  });

  it("rejects unsafe cross-origin write requests", async () => {
    const config = createTestConfig();
    const app = express();

    app.use(createOriginGuard(config));
    app.post("/write", (_request, response) => response.status(204).send());
    app.use(createErrorHandler(config));

    const response = await request(app)
      .post("/write")
      .set("Origin", "https://example.invalid")
      .send({})
      .expect(403);

    expect(response.body.error.code).toBe("ORIGIN_FORBIDDEN");
  });
});

function createFoundationServer(): { app: ReturnType<typeof createApp>; database: Database } {
  const config = createTestConfig();
  const database = openDatabase(config.databasePath);
  runMigrations(database);

  return {
    app: createApp(database, config),
    database
  };
}
