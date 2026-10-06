import type { AppConfig } from "../config/env.js";
import type { PostgresDatabase } from "./postgres.js";
import { hashPassword, signQrId } from "../security/crypto.js";

export type DevSeedInfo = {
  qrId: string;
  qrSignature: string;
  adminUsername: string;
  adminPassword: string;
};

const devQrId = "dev-table-1";
const devAdminUsername = "admin";
const devAdminPassword = "admin12345";

export async function ensurePostgresDevSeed(
  database: PostgresDatabase,
  config: AppConfig
): Promise<DevSeedInfo | null> {
  if (!config.enableDevSeed || config.nodeEnv === "production") {
    return null;
  }

  await database.query(
    "INSERT INTO dining_tables (label) VALUES ($1) ON CONFLICT (label) DO NOTHING;",
    ["Table 1"]
  );

  const tableRes = await database.query(
    "SELECT id FROM dining_tables WHERE label = $1;",
    ["Table 1"]
  );
  const table = tableRes.rows[0] as { id: number };

  await database.query(
    `
      INSERT INTO table_qr_codes (qr_identifier, dining_table_id)
      VALUES ($1, $2)
      ON CONFLICT (qr_identifier) DO NOTHING;
    `,
    [devQrId, table.id]
  );

  const staffCountRes = await database.query("SELECT COUNT(*) AS count FROM staff_users;");
  const staffCount = Number(staffCountRes.rows[0]?.count ?? 0);

  if (staffCount === 0) {
    await database.query(
      "INSERT INTO staff_users (username, password_hash) VALUES ($1, $2);",
      [devAdminUsername, hashPassword(devAdminPassword)]
    );
  }

  const menuCountRes = await database.query("SELECT COUNT(*) AS count FROM menu_categories;");
  const menuCount = Number(menuCountRes.rows[0]?.count ?? 0);

  if (menuCount === 0) {
    const categoryRes = await database.query(
      "INSERT INTO menu_categories (name, sort_order) VALUES ($1, $2) RETURNING id;",
      ["Sample", 0]
    );
    const categoryId = categoryRes.rows[0].id;

    await database.query(
      `
        INSERT INTO menu_items (category_id, name, price_paise, is_veg, sort_order)
        VALUES ($1, $2, $3, $4, $5);
      `,
      [categoryId, "Sample Item", 10000, 1, 0]
    );
  }

  return {
    qrId: devQrId,
    qrSignature: signQrId(devQrId, config.qrSecret),
    adminUsername: devAdminUsername,
    adminPassword: devAdminPassword
  };
}
