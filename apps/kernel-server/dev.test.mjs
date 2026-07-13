import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"

test("dev launcher starts Turbo apps and kernel-server", () => {
  const result = spawnSync(process.execPath, ["dev.mjs", "--dry-run"], {
    cwd: import.meta.dirname,
    encoding: "utf8",
  })

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout), [
    {
      command: "pnpm",
      args: ["turbo", "dev"],
      env: { NEXT_PUBLIC_KERNEL_SERVER_URL: "http://localhost:3006" },
    },
    {
      command: "go",
      args: ["run", "./cmd/server"],
      env: { SESSION_TICKET_SECRET: "development-only-ticket-secret" },
    },
  ])
})

test("root dev script uses the notebook dev launcher", async () => {
  const packageJson = JSON.parse(
    await readFile(resolve(import.meta.dirname, "../../package.json"), "utf8")
  )

  assert.equal(packageJson.scripts.dev, "node apps/kernel-server/dev.mjs")
})

test("dev launcher can spawn pnpm and Go on this platform", () => {
  const result = spawnSync(process.execPath, ["dev.mjs", "--check"], {
    cwd: import.meta.dirname,
    encoding: "utf8",
    timeout: 30_000,
  })

  assert.equal(result.status, 0, result.stderr)
})
