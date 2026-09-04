import { spawnSync } from "node:child_process";
import { hashPassword } from "../src/security/crypto.js";

const args = process.argv.slice(2);
const isRemote = !args.includes("--local");
const cleanArgs = args.filter((a) => a !== "--local" && a !== "--remote");

const newUsername = cleanArgs[0] || "admin";
const newPassword = cleanArgs[1];

if (!newPassword) {
  console.log("\n=======================================================");
  console.log("             D3 ADMIN CREDENTIALS MANAGER              ");
  console.log("=======================================================\n");
  console.log("Usage:");
  console.log("  npx tsx scripts/set-admin.ts <username> <new_password> [--remote|--local]\n");
  console.log("Examples:");
  console.log("  npx tsx scripts/set-admin.ts admin MySecretPass123");
  console.log("  npx tsx scripts/set-admin.ts manager StrongPass456 --remote");
  console.log("  npx tsx scripts/set-admin.ts admin TestPass123 --local\n");
  process.exit(1);
}

const passwordHash = hashPassword(newPassword);

console.log("\n=======================================================");
console.log("             D3 ADMIN CREDENTIALS MANAGER              ");
console.log("=======================================================\n");
console.log(`Target     : ${isRemote ? "Cloudflare D1 (Production Remote)" : "Local SQLite"}`);
console.log(`Username   : ${newUsername}`);
console.log(`Hash Format: ${passwordHash.split("$")[0]}`);
console.log("-------------------------------------------------------\n");

const sql = `INSERT INTO staff_users (id, username, password_hash) VALUES (1, '${newUsername}', '${passwordHash}') ON CONFLICT(id) DO UPDATE SET username = '${newUsername}', password_hash = '${passwordHash}';`;

try {
  const targetFlag = isRemote ? "--remote" : "--local";
  console.log(`Executing D1 update...`);
  const result = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", "D3_DB", targetFlag, `--command=${sql}`],
    { stdio: "inherit" }
  );
  if (result.status !== 0) {
    throw new Error(`Command exited with status ${result.status}`);
  }
  console.log("\n✨ Success! Admin credentials have been updated successfully.\n");
} catch (error) {
  console.error("\n❌ Failed to update admin credentials in D1:", error);
  process.exit(1);
}
