import { loadConfig } from "../config/env.js";
import { openDatabase } from "../db/database.js";
import { runMigrations } from "../db/migrations.js";
import { createApp } from "./createApp.js";

const config = loadConfig();
const database = openDatabase(config.databasePath);
runMigrations(database);

const app = createApp(database, config);

app.listen(config.port, () => {
  console.info(`D3 API listening on http://localhost:${config.port}`);
});
