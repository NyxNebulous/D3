import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Database = InstanceType<typeof DatabaseSync>;

export function openDatabase(path: string): Database {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }

  const database = new DatabaseSync(path);
  database.exec("PRAGMA foreign_keys = ON;");

  if (path !== ":memory:") {
    database.exec("PRAGMA journal_mode = WAL;");
  }

  return database;
}

export function transaction<T>(database: Database, work: () => T): T {
  database.exec("BEGIN IMMEDIATE;");

  try {
    const result = work();
    database.exec("COMMIT;");
    return result;
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

