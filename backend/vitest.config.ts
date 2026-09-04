import { defineConfig } from "vitest/config"
import dotenv from "dotenv"

// Load test env FIRST so it wins over backend/.env, which the app pulls in via
// `import 'dotenv/config'` (dotenv never overwrites an already-set variable).
dotenv.config({ path: ".env.test" })

export default defineConfig({
  test: {
    environment: "node",
    // Every suite truncates and reseeds the same Postgres database in beforeAll,
    // so files must not run concurrently or they delete each other's fixtures.
    fileParallelism: false,
    sequence: { concurrent: false },
    hookTimeout: 30_000,
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/test-db.ts", "src/lib/prismaSelects.ts"],
    },
  },
})
