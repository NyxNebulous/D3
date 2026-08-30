import { loadConfig } from "../config/env.js";
import { openDatabase } from "../db/database.js";
import { runMigrations } from "../db/migrations.js";
import { ensureDevSeed } from "../db/seed.js";
import { createApp } from "./createApp.js";

const config = loadConfig();
const database = openDatabase(config.databasePath);
runMigrations(database);

const devSeed = ensureDevSeed(database, config);
const app = createApp(database, config);

app.listen(config.port, () => {
  console.info(`D3 API listening on http://localhost:${config.port}`);

  if (devSeed) {
    console.info(
      `D3 dev QR URL: ${config.corsOrigin}/t/${devSeed.qrId}?sig=${devSeed.qrSignature}`
    );
    console.info(`D3 dev admin username: ${devSeed.adminUsername}`);
  }
});

