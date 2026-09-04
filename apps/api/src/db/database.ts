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

import type { D1Database, D1PreparedStatement, D1Response, D1Result } from "../types.js";

export function createSqliteD1Adapter(database: Database): D1Database {
  function createPreparedStatement(query: string, boundValues: unknown[] = []): D1PreparedStatement {
    return {
      bind(...values: unknown[]) {
        return createPreparedStatement(query, values);
      },
      async first<T = unknown>(colName?: string): Promise<T | null> {
        const stmt = database.prepare(query);
        const row = stmt.get(...(boundValues as any[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return (row[colName] as T) ?? null;
        return row as T;
      },
      async all<T = unknown>(): Promise<D1Result<T>> {
        const stmt = database.prepare(query);
        const results = stmt.all(...(boundValues as any[])) as T[];
        return {
          results,
          success: true,
          meta: {}
        };
      },
      async run(): Promise<D1Response> {
        const stmt = database.prepare(query);
        const info = stmt.run(...(boundValues as any[]));
        return {
          success: true,
          meta: {
            changes: Number(info.changes),
            last_row_id: Number(info.lastInsertRowid)
          }
        };
      }
    };
  }

  return {
    prepare(query: string) {
      return createPreparedStatement(query);
    },
    async dump(): Promise<ArrayBuffer> {
      throw new Error("dump not implemented in adapter");
    },
    async exec(query: string): Promise<D1Response> {
      database.exec(query);
      return { success: true, meta: {} };
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      database.exec("BEGIN IMMEDIATE;");
      try {
        const results: D1Result<T>[] = [];
        for (const s of statements) {
          const res = await s.all<T>();
          results.push(res);
        }
        database.exec("COMMIT;");
        return results;
      } catch (err) {
        database.exec("ROLLBACK;");
        throw err;
      }
    }
  };
}

