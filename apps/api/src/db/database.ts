import pg from "pg";
import type { D1Database, D1PreparedStatement, D1Response, D1Result } from "../types.js";

// Configure pg types:
// 20: INT8 (bigint, e.g. from COUNT(*)) -> number
pg.types.setTypeParser(20, (val: string) => Number(val));
// 1184: TIMESTAMPTZ -> ISO 8601 string
pg.types.setTypeParser(1184, (val: string) => new Date(val).toISOString());
// 1114: TIMESTAMP -> ISO 8601 string
pg.types.setTypeParser(1114, (val: string) => new Date(val.replace(" ", "T") + "Z").toISOString());

export type PostgresDatabase = pg.Pool;

export function transformQueryForPostgres(sql: string): string {
  let transformed = sql;

  // 1. Convert INSERT OR IGNORE INTO -> INSERT INTO ... ON CONFLICT DO NOTHING
  if (/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i.test(transformed)) {
    transformed = transformed.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i, "INSERT INTO");
    if (!/ON\s+CONFLICT/i.test(transformed)) {
      transformed = transformed.trim().replace(/;?$/, " ON CONFLICT DO NOTHING");
    }
  }

  // 2. Quote camelCase aliases: AS camelCase -> AS "camelCase"
  transformed = transformed.replace(/\bAS\s+([a-zA-Z0-9_]*[A-Z][a-zA-Z0-9_]*)\b/g, 'AS "$1"');

  // 3. Convert ? parameter placeholders outside string quotes to $1, $2, ...
  let paramIndex = 1;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let result = "";

  for (let i = 0; i < transformed.length; i++) {
    const char = transformed[i];
    if (char === "'" && (i === 0 || transformed[i - 1] !== "\\")) {
      inSingleQuote = !inSingleQuote;
      result += char;
    } else if (char === '"' && (i === 0 || transformed[i - 1] !== "\\")) {
      inDoubleQuote = !inDoubleQuote;
      result += char;
    } else if (char === "?" && !inSingleQuote && !inDoubleQuote) {
      result += `$${paramIndex++}`;
    } else {
      result += char;
    }
  }

  return result;
}

export type PostgresPreparedStatement = D1PreparedStatement & {
  _query: string;
  _values: unknown[];
  _runWithClient(executor: pg.Pool | pg.PoolClient): Promise<D1Response>;
  _allWithClient<T = unknown>(executor: pg.Pool | pg.PoolClient): Promise<D1Result<T>>;
  _firstWithClient<T = unknown>(executor: pg.Pool | pg.PoolClient, colName?: string): Promise<T | null>;
};

export function createPostgresPreparedStatement(
  pool: pg.Pool,
  rawQuery: string,
  boundValues: unknown[] = []
): PostgresPreparedStatement {
  const transformedQuery = transformQueryForPostgres(rawQuery);

  async function executeFirst<T = unknown>(
    executor: pg.Pool | pg.PoolClient,
    colName?: string
  ): Promise<T | null> {
    const res = await executor.query(transformedQuery, boundValues as any[]);
    if (!res.rows || res.rows.length === 0) {
      return null;
    }
    const row = res.rows[0];
    if (colName) {
      return (row[colName] as T) ?? null;
    }
    return row as T;
  }

  async function executeAll<T = unknown>(
    executor: pg.Pool | pg.PoolClient
  ): Promise<D1Result<T>> {
    const res = await executor.query(transformedQuery, boundValues as any[]);
    return {
      results: (res.rows ?? []) as T[],
      success: true,
      meta: {
        rowCount: res.rowCount ?? 0
      }
    };
  }

  async function executeRun(
    executor: pg.Pool | pg.PoolClient
  ): Promise<D1Response> {
    let sqlToRun = transformedQuery;
    const match = sqlToRun.match(/^\s*INSERT\s+INTO\s+([a-zA-Z0-9_"]+)/i);
    let shouldAddReturning = false;

    if (match && match[1] && !/RETURNING/i.test(sqlToRun)) {
      const table = match[1].replace(/"/g, "").toLowerCase();
      if (table !== "cart_items") {
        shouldAddReturning = true;
        sqlToRun = sqlToRun.trim().replace(/;?$/, " RETURNING id;");
      }
    }

    const res = await executor.query(sqlToRun, boundValues as any[]);
    let lastRowId: number | undefined = undefined;

    if (shouldAddReturning && res.rows && res.rows.length > 0 && res.rows[0].id !== undefined) {
      lastRowId = Number(res.rows[0].id);
    }

    return {
      success: true,
      meta: {
        changes: res.rowCount ?? 0,
        last_row_id: lastRowId
      }
    };
  }

  return {
    _query: transformedQuery,
    _values: boundValues,
    bind(...values: unknown[]) {
      return createPostgresPreparedStatement(pool, rawQuery, values);
    },
    async first<T = unknown>(colName?: string): Promise<T | null> {
      return executeFirst<T>(pool, colName);
    },
    async all<T = unknown>(): Promise<D1Result<T>> {
      return executeAll<T>(pool);
    },
    async run(): Promise<D1Response> {
      return executeRun(pool);
    },
    _firstWithClient: executeFirst,
    _allWithClient: executeAll,
    _runWithClient: executeRun
  };
}

export function createPostgresD1Adapter(pool: pg.Pool): D1Database {
  return {
    prepare(query: string) {
      return createPostgresPreparedStatement(pool, query);
    },
    async dump(): Promise<ArrayBuffer> {
      throw new Error("dump not implemented in postgres adapter");
    },
    async exec(query: string): Promise<D1Response> {
      const res = await pool.query(query);
      return {
        success: true,
        meta: {
          changes: res.rowCount ?? 0
        }
      };
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN;");
        const results: D1Result<T>[] = [];
        for (const s of statements) {
          const pgStmt = s as PostgresPreparedStatement;
          if (typeof pgStmt._allWithClient === "function") {
            const res = await pgStmt._allWithClient<T>(client);
            results.push(res);
          } else {
            const res = await s.all<T>();
            results.push(res);
          }
        }
        await client.query("COMMIT;");
        return results;
      } catch (err) {
        await client.query("ROLLBACK;");
        throw err;
      } finally {
        client.release();
      }
    }
  };
}

export async function openPostgres(connectionString: string): Promise<pg.Pool> {
  const pool = new pg.Pool({ connectionString });
  // Verify connection
  const client = await pool.connect();
  client.release();
  return pool;
}
