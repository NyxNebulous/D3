import { randomBytes, randomUUID } from "node:crypto";
import { Router } from "express";
import { customerLoginSchema, requestOtpSchema, verifyOtpSchema } from "@d3/shared";
import type { AppConfig } from "../../config/env.js";
import type { Database } from "../../db/database.js";
import { transaction } from "../../db/database.js";
import { toSqliteTimestamp } from "../../db/time.js";
import { asyncHandler, AppError } from "../../middleware/errors.js";
import { createRateLimiter } from "../../middleware/rateLimit.js";
import { validateBody } from "../../middleware/requestValidation.js";
import {
  clearCookieOptions,
  cookieOptions,
  customerSessionCookie,
  preSessionCookie,
  requireCustomerSession,
  requirePreSession,
  revokeSessionCookie
} from "../../middleware/sessionAuth.js";
import {
  createOpaqueToken,
  createOtp,
  hashOtp,
  hashToken,
  verifyOtp
} from "../../security/crypto.js";

type OtpChallengeRow = {
  id: string;
  preSessionId: number;
  name: string;
  mobileNumber: string;
  otpHash: string;
  salt: string;
  attempts: number;
};

export function createAuthRouter(database: Database, config: AppConfig): Router {
  const router = Router();

  router.post(
    "/customer/login",
    requirePreSession(database),
    createRateLimiter({
      keyPrefix: "customer-login",
      limit: 10,
      windowMs: 10 * 60 * 1000,
      key: (request) => `${request.ip}:${String(request.body.mobileNumber ?? "")}`
    }),
    validateBody(customerLoginSchema),
    asyncHandler((request, response) => {
      if (!request.preSession) {
        throw new AppError(401, "PRE_SESSION_REQUIRED", "Scan a valid table QR code first");
      }

      const { name, mobileNumber } = request.body as { name: string; mobileNumber: string };
      const preSession = request.preSession;

      const result = transaction(database, () => {
        database
          .prepare(
            `
              INSERT INTO customers (name, mobile_number)
              VALUES (?, ?)
              ON CONFLICT(mobile_number) DO UPDATE SET
                name = excluded.name,
                updated_at = CURRENT_TIMESTAMP
            `
          )
          .run(name, mobileNumber);

        const customer = database
          .prepare("SELECT id, name, mobile_number AS mobileNumber FROM customers WHERE mobile_number = ?")
          .get(mobileNumber) as { id: number; name: string; mobileNumber: string };

        database
          .prepare("UPDATE pre_verification_sessions SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?")
          .run(preSession.id);

        const token = createOpaqueToken();
        const expiresAt = toSqliteTimestamp(new Date(Date.now() + config.customerSessionTtlMs));

        const insert = database
          .prepare(
            `
              INSERT INTO customer_sessions (
                token_hash,
                customer_id,
                dining_table_id,
                expires_at
              )
              VALUES (?, ?, ?, ?)
            `
          )
          .run(hashToken(token), customer.id, preSession.diningTableId, expiresAt);

        return {
          token,
          expiresAt,
          customer,
          sessionId: Number(insert.lastInsertRowid)
        };
      });

      response.clearCookie(preSessionCookie, clearCookieOptions(config));
      response.cookie(customerSessionCookie, result.token, cookieOptions(config, config.customerSessionTtlMs));
      response.json({
        customer: {
          name: result.customer.name,
          mobileNumber: result.customer.mobileNumber
        },
        table: {
          label: request.preSession.tableLabel
        },
        session: {
          id: result.sessionId,
          expiresAt: result.expiresAt
        }
      });
    })
  );

  router.post(
    "/customer/request-otp",
    requirePreSession(database),
    createRateLimiter({
      keyPrefix: "otp-request",
      limit: 5,
      windowMs: 10 * 60 * 1000,
      key: (request) => `${request.ip}:${String(request.body.mobileNumber ?? "")}`
    }),
    validateBody(requestOtpSchema),
    asyncHandler((request, response) => {
      if (!request.preSession) {
        throw new AppError(401, "PRE_SESSION_REQUIRED", "Scan a valid table QR code first");
      }

      const { name, mobileNumber } = request.body as { name: string; mobileNumber: string };
      const otp = createOtp();
      const salt = randomBytes(16).toString("hex");
      const challengeId = randomUUID();
      const expiresAt = toSqliteTimestamp(new Date(Date.now() + config.otpTtlMs));

      database
        .prepare(
          `
            INSERT INTO otp_challenges (
              id,
              pre_session_id,
              name,
              mobile_number,
              otp_hash,
              salt,
              expires_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          challengeId,
          request.preSession.id,
          name,
          mobileNumber,
          hashOtp(otp, salt, config.sessionSecret),
          salt,
          expiresAt
        );

      response.json({
        challengeId,
        expiresAt,
        ...(config.nodeEnv === "production" ? {} : { devOtp: otp })
      });
    })
  );

  router.post(
    "/customer/verify-otp",
    requirePreSession(database),
    createRateLimiter({
      keyPrefix: "otp-verify",
      limit: 10,
      windowMs: 10 * 60 * 1000,
      key: (request) => `${request.ip}:${String(request.body.challengeId ?? "")}`
    }),
    validateBody(verifyOtpSchema),
    asyncHandler((request, response) => {
      if (!request.preSession) {
        throw new AppError(401, "PRE_SESSION_REQUIRED", "Scan a valid table QR code first");
      }

      const { challengeId, otp } = request.body as { challengeId: string; otp: string };

      const challenge = database
        .prepare(
          `
            SELECT
              id,
              pre_session_id AS preSessionId,
              name,
              mobile_number AS mobileNumber,
              otp_hash AS otpHash,
              salt,
              attempts
            FROM otp_challenges
            WHERE id = ?
              AND pre_session_id = ?
              AND consumed_at IS NULL
              AND expires_at > CURRENT_TIMESTAMP
          `
        )
        .get(challengeId, request.preSession.id) as OtpChallengeRow | undefined;

      if (!challenge || challenge.attempts >= config.otpMaxAttempts) {
        throw new AppError(400, "OTP_INVALID", "OTP could not be verified");
      }

      if (!verifyOtp(otp, challenge.salt, config.sessionSecret, challenge.otpHash)) {
        database
          .prepare("UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?")
          .run(challengeId);
        throw new AppError(400, "OTP_INVALID", "OTP could not be verified");
      }

      const preSession = request.preSession;

      const result = transaction(database, () => {
        database
          .prepare(
            `
              INSERT INTO customers (name, mobile_number)
              VALUES (?, ?)
              ON CONFLICT(mobile_number) DO UPDATE SET
                name = excluded.name,
                updated_at = CURRENT_TIMESTAMP
            `
          )
          .run(challenge.name, challenge.mobileNumber);

        const customer = database
          .prepare("SELECT id, name, mobile_number AS mobileNumber FROM customers WHERE mobile_number = ?")
          .get(challenge.mobileNumber) as { id: number; name: string; mobileNumber: string };

        database
          .prepare("UPDATE otp_challenges SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?")
          .run(challengeId);
        database
          .prepare("UPDATE pre_verification_sessions SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?")
          .run(preSession.id);

        const token = createOpaqueToken();
        const expiresAt = toSqliteTimestamp(new Date(Date.now() + config.customerSessionTtlMs));

        const insert = database
          .prepare(
            `
              INSERT INTO customer_sessions (
                token_hash,
                customer_id,
                dining_table_id,
                expires_at
              )
              VALUES (?, ?, ?, ?)
            `
          )
          .run(hashToken(token), customer.id, preSession.diningTableId, expiresAt);

        return {
          token,
          expiresAt,
          customer,
          sessionId: Number(insert.lastInsertRowid)
        };
      });

      response.clearCookie(preSessionCookie, clearCookieOptions(config));
      response.cookie(customerSessionCookie, result.token, cookieOptions(config, config.customerSessionTtlMs));
      response.json({
        customer: {
          name: result.customer.name,
          mobileNumber: result.customer.mobileNumber
        },
        table: {
          label: request.preSession.tableLabel
        },
        session: {
          id: result.sessionId,
          expiresAt: result.expiresAt
        }
      });
    })
  );

  router.get(
    "/customer/session",
    requireCustomerSession(database),
    asyncHandler((request, response) => {
      if (!request.customerSession) {
        throw new AppError(401, "CUSTOMER_AUTH_REQUIRED", "Customer authentication is required");
      }

      response.json({
        customer: {
          name: request.customerSession.customerName,
          mobileNumber: request.customerSession.mobileNumber
        },
        table: {
          label: request.customerSession.tableLabel
        }
      });
    })
  );

  router.post(
    "/customer/logout",
    requireCustomerSession(database),
    asyncHandler((request, response) => {
      revokeSessionCookie(database, request, customerSessionCookie, "customer_sessions");
      response.clearCookie(customerSessionCookie, clearCookieOptions(config));
      response.status(204).send();
    })
  );

  return router;
}
