import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    // This is the heaviest suite in the workspace and `pnpm test` runs it
    // alongside three others at once. Left unbounded, vitest spawns a fork per
    // file per package and the run dies with "Failed to start forks worker" -
    // a red build that says nothing about the code and says something
    // different each run. Capping the pool trades a slower suite for one that
    // means what it says.
    maxWorkers: 2,
    // The Pyodide-adjacent bootstrap suites need ~35s of pure test time. The
    // 5s default passes them alone and fails them under load.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})
