// Apply migrations to the test database.
// Reads DATABASE_URL from backend/.env.test so no credentials live in package.json.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(backendDir, ".env.test");

if (!fs.existsSync(envPath)) {
  console.error(`Missing ${envPath}. Copy .env.example and point DATABASE_URL at your test database.`);
  process.exit(1);
}

const { parsed, error } = dotenv.config({ path: envPath, override: true });
if (error) {
  console.error(`Could not read ${envPath}:`, error.message);
  process.exit(1);
}

if (!parsed?.DATABASE_URL) {
  console.error(`${envPath} does not define DATABASE_URL.`);
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  cwd: backendDir,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: parsed.DATABASE_URL },
});

process.exit(result.status ?? 1);
