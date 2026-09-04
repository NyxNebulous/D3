import { serve } from "@hono/node-server";
import { createHonoApp } from "../app.js";
import { loadConfig } from "../config/env.js";
import { openDatabase, createSqliteD1Adapter } from "../db/database.js";
import { runMigrations } from "../db/migrations.js";
import { ensureDevSeed } from "../db/seed.js";

const config = loadConfig();
const database = openDatabase(config.databasePath);
runMigrations(database);

const devSeed = ensureDevSeed(database, config);
const d1Database = createSqliteD1Adapter(database);

const app = createHonoApp({
  D3_DB: d1Database,
  HMAC_SECRET: config.qrSecret,
  SESSION_SECRET: config.sessionSecret,
  CORS_ORIGIN: config.corsOrigin,
  NODE_ENV: config.nodeEnv
});

serve(
  {
    fetch: app.fetch,
    port: config.port
  },
  (info) => {
    console.info(`D3 Hono API listening on http://localhost:${info.port}`);

    if (devSeed) {
      console.info(
        `D3 dev QR URL: ${config.corsOrigin}/t/${devSeed.qrId}?sig=${devSeed.qrSignature}`
      );
      console.info(`D3 dev admin username: ${devSeed.adminUsername}`);
    }
  }
);
