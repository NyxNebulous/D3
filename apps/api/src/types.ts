// Cloudflare Worker Environment Bindings and Types

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Response>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Response {
  success: boolean;
  meta: {
    changes?: number;
    last_row_id?: number;
    duration?: number;
    served_by?: string;
  };
  error?: string;
}

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
  error?: string;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Response>;
}

export type Env = {
  D3_DB: D1Database;
  HMAC_SECRET?: string;
  SESSION_SECRET?: string;
  CORS_ORIGIN?: string;
  NODE_ENV?: string;
  ADMIN_INITIAL_PASSWORD?: string;
};

export type CustomerSession = {
  id: number;
  customerId: number;
  customerName: string;
  customerMobile: string;
  diningTableId: number;
  tableLabel: string;
  expiresAt: string;
};

export type StaffSession = {
  id: number;
  staffUserId: number;
  username: string;
  expiresAt: string;
};
