import { describe, expect, it, vi } from "vitest"

import { configureHttpApp } from "./bootstrap"

type OriginCallback = (error: Error | null, allowed?: boolean) => void

function harness(env: NodeJS.ProcessEnv) {
  const app = {
    enableCors: vi.fn(),
    useGlobalPipes: vi.fn(),
  }
  configureHttpApp(app as never, env)
  const cors = app.enableCors.mock.calls[0]?.[0] as {
    origin: (origin: string | undefined, callback: OriginCallback) => void
  }
  const allows = (origin: string | undefined) =>
    new Promise<boolean>((resolve, reject) => {
      cors.origin(origin, (error, allowed) => {
        if (error) reject(error)
        else resolve(Boolean(allowed))
      })
    })
  return { app, allows }
}

describe("configureHttpApp", () => {
  it("installs one global validation policy", () => {
    const { app } = harness({ NODE_ENV: "test" })
    expect(app.useGlobalPipes).toHaveBeenCalledTimes(1)
    expect(app.enableCors).toHaveBeenCalledTimes(1)
  }, 60_000)

  it("fails closed for browser origins in production when allowlist is empty", async () => {
    const { allows } = harness({ NODE_ENV: "production", FRONTEND_ORIGINS: "" })
    await expect(allows("https://attacker.example")).resolves.toBe(false)
    await expect(
      allows("https://tlh222k-preview-idis.vercel.app")
    ).resolves.toBe(false)
    await expect(allows(undefined)).resolves.toBe(true)
  })

  it("keeps explicit localhost defaults outside production", async () => {
    const { allows } = harness({ NODE_ENV: "development" })
    await expect(allows("http://localhost:3000")).resolves.toBe(true)
    await expect(allows("https://attacker.example")).resolves.toBe(false)
  })
})
