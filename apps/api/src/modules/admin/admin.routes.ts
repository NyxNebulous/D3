import { Router } from "express";
import { adminLoginSchema } from "@d3/shared";
import type { AppConfig } from "../../config/env.js";
import type { Database } from "../../db/database.js";
import { toSqliteTimestamp } from "../../db/time.js";
import { asyncHandler, AppError } from "../../middleware/errors.js";
import { createRateLimiter } from "../../middleware/rateLimit.js";
import { validateBody } from "../../middleware/requestValidation.js";
import {
  clearCookieOptions,
  cookieOptions,
  requireStaffSession,
  revokeSessionCookie,
  staffSessionCookie
} from "../../middleware/sessionAuth.js";
import { createOpaqueToken, hashToken, verifyPassword } from "../../security/crypto.js";

type StaffUserRow = {
  id: number;
  username: string;
  passwordHash: string;
};

export function createAdminRouter(database: Database, config: AppConfig): Router {
  const router = Router();

  router.post(
    "/admin/login",
    createRateLimiter({
      keyPrefix: "admin-login",
      limit: 10,
      windowMs: 10 * 60 * 1000,
      key: (request) => `${request.ip}:${String(request.body.username ?? "")}`
    }),
    validateBody(adminLoginSchema),
    asyncHandler((request, response) => {
      const { username, password } = request.body as { username: string; password: string };
      const staff = database
        .prepare(
          `
            SELECT id, username, password_hash AS passwordHash
            FROM staff_users
            WHERE username = ?
          `
        )
        .get(username) as StaffUserRow | undefined;

      if (!staff || !verifyPassword(password, staff.passwordHash)) {
        throw new AppError(401, "INVALID_CREDENTIALS", "Invalid username or password");
      }

      const token = createOpaqueToken();
      const expiresAt = toSqliteTimestamp(new Date(Date.now() + config.staffSessionTtlMs));

      const insert = database
        .prepare(
          `
            INSERT INTO staff_sessions (token_hash, staff_user_id, expires_at)
            VALUES (?, ?, ?)
          `
        )
        .run(hashToken(token), staff.id, expiresAt);

      response.cookie(staffSessionCookie, token, cookieOptions(config, config.staffSessionTtlMs));
      response.json({
        staff: {
          id: staff.id,
          username: staff.username
        },
        session: {
          id: Number(insert.lastInsertRowid),
          expiresAt
        }
      });
    })
  );

  router.get(
    "/admin/session",
    requireStaffSession(database),
    asyncHandler((request, response) => {
      if (!request.staffSession) {
        throw new AppError(401, "STAFF_AUTH_REQUIRED", "Staff authentication is required");
      }

      response.json({
        staff: {
          id: request.staffSession.staffUserId,
          username: request.staffSession.username
        }
      });
    })
  );

  router.post(
    "/admin/logout",
    requireStaffSession(database),
    asyncHandler((request, response) => {
      revokeSessionCookie(database, request, staffSessionCookie, "staff_sessions");
      response.clearCookie(staffSessionCookie, clearCookieOptions(config));
      response.status(204).send();
    })
  );

  return router;
}
