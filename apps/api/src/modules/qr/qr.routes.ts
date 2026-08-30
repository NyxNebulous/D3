import { Router } from "express";
import { qrValidateRequestSchema } from "@d3/shared";
import type { AppConfig } from "../../config/env.js";
import type { Database } from "../../db/database.js";
import { toSqliteTimestamp } from "../../db/time.js";
import { asyncHandler, AppError } from "../../middleware/errors.js";
import { cookieOptions, preSessionCookie } from "../../middleware/sessionAuth.js";
import { validateBody } from "../../middleware/requestValidation.js";
import { createOpaqueToken, hashToken, verifyQrSignature } from "../../security/crypto.js";

type QrRow = {
  id: number;
  diningTableId: number;
  tableLabel: string;
};

export function createQrRouter(database: Database, config: AppConfig): Router {
  const router = Router();

  router.post(
    "/validate",
    validateBody(qrValidateRequestSchema),
    asyncHandler((request, response) => {
      const { qrId, signature } = request.body as { qrId: string; signature: string };

      if (!verifyQrSignature(qrId, signature, config.qrSecret)) {
        throw new AppError(400, "INVALID_QR", "Invalid QR code");
      }

      const qr = database
        .prepare(
          `
            SELECT
              table_qr_codes.id,
              table_qr_codes.dining_table_id AS diningTableId,
              dining_tables.label AS tableLabel
            FROM table_qr_codes
            JOIN dining_tables ON dining_tables.id = table_qr_codes.dining_table_id
            WHERE table_qr_codes.qr_identifier = ?
              AND table_qr_codes.revoked_at IS NULL
              AND dining_tables.active = 1
          `
        )
        .get(qrId) as QrRow | undefined;

      if (!qr) {
        throw new AppError(404, "INVALID_QR", "Invalid QR code");
      }

      const token = createOpaqueToken();
      const expiresAt = toSqliteTimestamp(new Date(Date.now() + config.preSessionTtlMs));

      database
        .prepare(
          `
            INSERT INTO pre_verification_sessions (
              token_hash,
              dining_table_id,
              table_qr_code_id,
              expires_at
            )
            VALUES (?, ?, ?, ?)
          `
        )
        .run(hashToken(token), qr.diningTableId, qr.id, expiresAt);

      response.cookie(preSessionCookie, token, cookieOptions(config, config.preSessionTtlMs));
      response.json({
        table: {
          label: qr.tableLabel
        },
        expiresAt
      });
    })
  );

  return router;
}
