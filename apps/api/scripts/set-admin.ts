import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { spawnSync } from "node:child_process";
import { hashPassword } from "../src/security/crypto.js";

const args = process.argv.slice(2);
const hasLocal = args.includes("--local") || Boolean(process.env.npm_config_local);
const hasRemote = args.includes("--remote") || args.includes("--prod") || Boolean(process.env.npm_config_remote);
const doBoth = !hasLocal && !hasRemote;

const cleanArgs = args.filter((a) => !a.startsWith("--"));
const newUsername = cleanArgs[0] || "admin";
const newPassword = cleanArgs[1];

if (!newPassword) {
  console.log("\n=======================================================");
  console.log("             D3 ADMIN CREDENTIALS MANAGER              ");
  console.log("=======================================================\n");
  console.log("Usage:");
  console.log("  npx tsx scripts/set-admin.ts <username> <new_password> [--local | --remote]\n");
  console.log("Examples:");
  console.log("  npm run set-admin -- admin 2026            (updates both local & remote)");
  console.log("  npm run set-admin -- admin 2026 --local    (updates local SQLite only)");
  console.log("  npm run set-admin -- admin 2026 --remote   (updates Cloudflare D1 only)\n");
  process.exit(1);
}

const passwordHash = hashPassword(newPassword);

console.log("\n=======================================================");
console.log("             D3 ADMIN CREDENTIALS MANAGER              ");
console.log("=======================================================\n");
console.log(`Username   : ${newUsername}`);
console.log(`Hash Format: ${passwordHash.split("$")[0]}`);
console.log(`Hash Salt  : ${passwordHash.split("$")[1]}`);
console.log("-------------------------------------------------------\n");

// 1. Update Local SQLite Database
if (hasLocal || doBoth) {
  const possiblePaths = [
    resolve(process.cwd(), "data/d3.sqlite"),
    resolve(process.cwd(), "apps/api/data/d3.sqlite"),
    resolve(import.meta.dirname, "../data/d3.sqlite")
  ];
  const localDbPath = possiblePaths.find((p) => existsSync(p));

  if (localDbPath) {
    try {
      const db = new DatabaseSync(localDbPath);
      db.prepare(`
        INSERT INTO staff_users (id, username, password_hash)
        VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET username = excluded.username, password_hash = excluded.password_hash
      `).run(newUsername, passwordHash);
      console.log(`✅ Local SQLite Database updated: ${localDbPath}`);
    } catch (err) {
      console.error(`❌ Failed to update local SQLite database:`, err);
    }
  } else {
    console.log(`ℹ️  No local data/d3.sqlite found to update.`);
  }
}

// 2. Update Remote Cloudflare D1 Database
if (hasRemote || doBoth) {
  const sql = `INSERT INTO staff_users (id, username, password_hash) VALUES (1, '${newUsername}', '${passwordHash}') ON CONFLICT(id) DO UPDATE SET username = '${newUsername}', password_hash = '${passwordHash}';`;
  console.log(`⏳ Cloudflare D1 Remote Database updating...`);
  const result = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", "D3_DB", "--remote", `--command=${sql}`],
    { stdio: "inherit" }
  );
  if (result.status === 0) {
    console.log(`✅ Cloudflare D1 Remote Database updated.`);
  } else {
    console.error(`❌ Cloudflare D1 update exited with status ${result.status}`);
  }
}

console.log("\n✨ Admin credentials successfully updated!\n");
