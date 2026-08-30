import type { AppConfig } from "../config/env.js";
import type { Database } from "./database.js";
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

export function ensureDevSeed(database: Database, config: AppConfig): DevSeedInfo | null {
  if (!config.enableDevSeed || config.nodeEnv === "production") {
    return null;
  }

  database
    .prepare("INSERT OR IGNORE INTO dining_tables (label) VALUES (?)")
    .run("Table 1");

  const table = database
    .prepare("SELECT id FROM dining_tables WHERE label = ?")
    .get("Table 1") as { id: number };

  database
    .prepare(
      `
        INSERT OR IGNORE INTO table_qr_codes (qr_identifier, dining_table_id)
        VALUES (?, ?)
      `
    )
    .run(devQrId, table.id);

  const staffCount = database.prepare("SELECT COUNT(*) AS count FROM staff_users").get() as {
    count: number;
  };

  if (staffCount.count === 0) {
    database
      .prepare("INSERT INTO staff_users (username, password_hash) VALUES (?, ?)")
      .run(devAdminUsername, hashPassword(devAdminPassword));
  }

  const menuCount = database.prepare("SELECT COUNT(*) AS count FROM menu_categories").get() as {
    count: number;
  };

  if (menuCount.count === 0) {
    const category = database
      .prepare("INSERT INTO menu_categories (name, sort_order) VALUES (?, ?)")
      .run("Sample", 0);
    database
      .prepare(
        `
          INSERT INTO menu_items (category_id, name, price_paise, is_veg, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `
      )
      .run(Number(category.lastInsertRowid), "Sample Item", 10000, 1, 0);
  }

  return {
    qrId: devQrId,
    qrSignature: signQrId(devQrId, config.qrSecret),
    adminUsername: devAdminUsername,
    adminPassword: devAdminPassword
  };
}

