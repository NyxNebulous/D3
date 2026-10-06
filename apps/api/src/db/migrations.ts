import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PostgresDatabase } from "./postgres.js";

function getPostgresMigrationsDir(): string {
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

export async function runPostgresMigrations(database: PostgresDatabase): Promise<void> {
  await database.query(`
    CREATE TABLE IF NOT EXISTS d1_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = getPostgresMigrationsDir();
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const existing = await database.query("SELECT 1 FROM d1_migrations WHERE name = $1", [file]);

    if (existing.rowCount && existing.rowCount > 0) {
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf-8");

    const client = await database.connect();
    try {
      await client.query("BEGIN;");
      await client.query(sql);
      await client.query("INSERT INTO d1_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT;");
    } catch (err) {
      await client.query("ROLLBACK;");
      throw err;
    } finally {
      client.release();
    }
  }
}
