/**
 * Generate a secure admin API key
 * Run: npx tsx scripts/generate-admin-key.ts
 */

import { randomBytes } from "crypto";

const key = `kcc_admin_${randomBytes(32).toString("hex")}`;
console.log("\n── Generated Admin API Key ──────────────────────────────");
console.log(key);
console.log("\nAdd to .env:");
console.log(`ADMIN_API_KEY="${key}"`);
console.log("────────────────────────────────────────────────────────\n");
