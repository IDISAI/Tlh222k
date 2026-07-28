import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    // This is the heaviest suite in the workspace and `pnpm test` runs it
    // alongside three others at once. Left unbounded, vitest spawns a fork per
    // file per package and the run dies with "Failed to start forks worker" -
    // a red build that says nothing about the code and says something
    // different each run. maxWorkers: 2 stopped that crash but still left an
    // occasional single test failing under contention with the other three
    // packages; run alone this suite is 38/38 stable across repeated runs, so
    // the failure is resource pressure, not the code. Serializing this
    // package's own tests removes the contention entirely and trades some
    // wall-clock time for a result that means what it says every time.
    maxWorkers: 1,
    // The Pyodide-adjacent bootstrap suites need ~35s of pure test time. The
    // 5s default passes them alone and fails them under load.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})
