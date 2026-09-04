// Installs the repo's git hooks by pointing core.hooksPath at .githooks/.
// Run once per clone:  npm run hooks:install
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const result = spawnSync("git", ["config", "core.hooksPath", ".githooks"], {
  cwd: repoRoot,
  stdio: "inherit",
  shell: true,
});

if (result.status === 0) {
  console.log("Git hooks installed (core.hooksPath -> .githooks).");
  console.log("Pre-push will now run the backend typecheck and test suite.");
} else {
  console.error("Could not set core.hooksPath.");
  process.exit(result.status ?? 1);
}
