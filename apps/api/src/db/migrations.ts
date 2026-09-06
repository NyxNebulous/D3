import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "./database.js";
import { transaction } from "./database.js";

function getMigrationsDir(): string {
  const candidates = [
    fileURLToPath(new URL("../../migrations", import.meta.url)),
    path.resolve(process.cwd(), "migrations"),
    path.resolve(process.cwd(), "apps/api/migrations")
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      return dir;
    }
  }

  throw new Error(`Could not locate migrations directory. Tried: ${candidates.join(", ")}`);
}

export function runMigrations(database: Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS d1_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = getMigrationsDir();
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const existing = database
      .prepare("SELECT 1 FROM d1_migrations WHERE name = ?")
      .get(file);

    if (existing) {
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf-8");

    transaction(database, () => {
      database.exec(sql);
      database.prepare("INSERT INTO d1_migrations (name) VALUES (?)").run(file);
    });
  }
}
