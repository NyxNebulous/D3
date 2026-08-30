import type { Database } from "./database.js";
import { transaction } from "./database.js";

type Migration = {
  id: number;
  name: string;
  sql: string;
};

const migrations: Migration[] = [];

export function runMigrations(database: Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  for (const migration of migrations) {
    const existing = database
      .prepare("SELECT id FROM schema_migrations WHERE id = ?")
      .get(migration.id);

    if (existing) {
      continue;
    }

    transaction(database, () => {
      database.exec(migration.sql);
      database
        .prepare("INSERT INTO schema_migrations (id, name) VALUES (?, ?)")
        .run(migration.id, migration.name);
    });
  }
}
