import type { CookieOptions, NextFunction, Request, Response } from "express";
import type { AppConfig } from "../config/env.js";
import type { Database } from "../db/database.js";
import { hashToken } from "../security/crypto.js";
import { AppError } from "./errors.js";

export const preSessionCookie = "d3_pre_session";
export const customerSessionCookie = "d3_customer_session";
export const staffSessionCookie = "d3_staff_session";

export type PreSessionContext = {
  id: number;
  diningTableId: number;
  tableQrCodeId: number;
  tableLabel: string;
};

export type CustomerSessionContext = {
  id: number;
  customerId: number;
  customerName: string;
  mobileNumber: string;
  diningTableId: number;
  tableLabel: string;
};

export type StaffSessionContext = {
  id: number;
  staffUserId: number;
  username: string;
};

declare global {
  namespace Express {
    interface Request {
      preSession?: PreSessionContext;
      customerSession?: CustomerSessionContext;
      staffSession?: StaffSessionContext;
    }
  }
}

export function cookieOptions(config: AppConfig, maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secureCookies,
    path: "/",
    maxAge: maxAgeMs
  };
}

export function clearCookieOptions(config: AppConfig): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secureCookies,
    path: "/"
  };
}

export function requirePreSession(database: Database) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const token = getCookie(request, preSessionCookie);

    if (!token) {
      next(new AppError(401, "PRE_SESSION_REQUIRED", "Scan a valid table QR code first"));
      return;
    }

    const session = database
      .prepare(
        `
          SELECT
            pre_verification_sessions.id,
            pre_verification_sessions.dining_table_id AS diningTableId,
            pre_verification_sessions.table_qr_code_id AS tableQrCodeId,
            dining_tables.label AS tableLabel
          FROM pre_verification_sessions
          JOIN dining_tables ON dining_tables.id = pre_verification_sessions.dining_table_id
          WHERE pre_verification_sessions.token_hash = ?
            AND pre_verification_sessions.consumed_at IS NULL
            AND pre_verification_sessions.expires_at > CURRENT_TIMESTAMP
            AND dining_tables.active = 1
        `
      )
      .get(hashToken(token)) as PreSessionContext | undefined;

    if (!session) {
      next(new AppError(401, "PRE_SESSION_REQUIRED", "Scan a valid table QR code first"));
      return;
    }

    request.preSession = session;
    next();
  };
}

export function requireCustomerSession(database: Database) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const token = getCookie(request, customerSessionCookie);

    if (!token) {
      next(new AppError(401, "CUSTOMER_AUTH_REQUIRED", "Customer authentication is required"));
      return;
    }

    const session = database
      .prepare(
        `
          SELECT
            customer_sessions.id,
            customer_sessions.customer_id AS customerId,
            customers.name AS customerName,
            customers.mobile_number AS mobileNumber,
            customer_sessions.dining_table_id AS diningTableId,
            dining_tables.label AS tableLabel
          FROM customer_sessions
          JOIN customers ON customers.id = customer_sessions.customer_id
          JOIN dining_tables ON dining_tables.id = customer_sessions.dining_table_id
          WHERE customer_sessions.token_hash = ?
            AND customer_sessions.revoked_at IS NULL
            AND customer_sessions.expires_at > CURRENT_TIMESTAMP
            AND dining_tables.active = 1
        `
      )
      .get(hashToken(token)) as CustomerSessionContext | undefined;

    if (!session) {
      next(new AppError(401, "CUSTOMER_AUTH_REQUIRED", "Customer authentication is required"));
      return;
    }

    database
      .prepare("UPDATE customer_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(session.id);

    request.customerSession = session;
    next();
  };
}

export function requireStaffSession(database: Database) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const token = getCookie(request, staffSessionCookie);

    if (!token) {
      next(new AppError(401, "STAFF_AUTH_REQUIRED", "Staff authentication is required"));
      return;
    }

    const session = database
      .prepare(
        `
          SELECT
            staff_sessions.id,
            staff_sessions.staff_user_id AS staffUserId,
            staff_users.username
          FROM staff_sessions
          JOIN staff_users ON staff_users.id = staff_sessions.staff_user_id
          WHERE staff_sessions.token_hash = ?
            AND staff_sessions.revoked_at IS NULL
            AND staff_sessions.expires_at > CURRENT_TIMESTAMP
        `
      )
      .get(hashToken(token)) as StaffSessionContext | undefined;

    if (!session) {
      next(new AppError(401, "STAFF_AUTH_REQUIRED", "Staff authentication is required"));
      return;
    }

    database
      .prepare("UPDATE staff_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(session.id);

    request.staffSession = session;
    next();
  };
}

export function revokeSessionCookie(database: Database, request: Request, cookieName: string, tableName: string): void {
  const token = getCookie(request, cookieName);

  if (!token) {
    return;
  }

  database
    .prepare(`UPDATE ${tableName} SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?`)
    .run(hashToken(token));
}

function getCookie(request: Request, name: string): string | undefined {
  const cookies = request.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[name];
}

