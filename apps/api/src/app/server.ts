import { serve } from "@hono/node-server";
import { createHonoApp } from "../app.js";
import { loadConfig } from "../config/env.js";
import { createPostgresD1Adapter, openPostgres } from "../db/database.js";
import { runPostgresMigrations } from "../db/migrations.js";
import { ensurePostgresDevSeed } from "../db/seed.js";

const config = loadConfig();
if (!config.databaseUrl) {
  throw new Error("DATABASE_URL is required to start the API");
}

const database = await openPostgres(config.databaseUrl);
await runPostgresMigrations(database);

const devSeed = await ensurePostgresDevSeed(database, config);
const d1Database = createPostgresD1Adapter(database);

const app = createHonoApp({
  D3_DB: d1Database,
  HMAC_SECRET: config.qrSecret,
  SESSION_SECRET: config.sessionSecret,
  CORS_ORIGIN: config.corsOrigin,
  NODE_ENV: config.nodeEnv,
  TELEGRAM_BOT_TOKEN: config.telegramBotToken,
  TELEGRAM_CHAT_ID: config.telegramChatId
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
