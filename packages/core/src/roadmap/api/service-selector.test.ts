import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../roadmap.service", () => ({
  RoadmapService: class MockRoadmapService {},
}))
vi.mock("./roadmap.api", () => ({ RoadmapApi: class RoadmapApi {} }))
vi.mock("./client", () => ({
  roadmapBackendEnabled: () =>
    Boolean(process.env.NEXT_PUBLIC_SVC_API_URL?.trim()),
}))

const originalEnv = { ...process.env }

describe("roadmap service selector", () => {
  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it("fails closed when production backend URL is missing", async () => {
    process.env.NODE_ENV = "production"
    delete process.env.NEXT_PUBLIC_SVC_API_URL
    delete process.env.NEXT_PUBLIC_SVC_ROADMAP_URL
    vi.resetModules()

    await expect(import("./service-selector")).rejects.toThrow(
      "NEXT_PUBLIC_SVC_API_URL is required in production"
    )
  }, 30_000)

  it("retains mock fallback outside production", async () => {
    process.env.NODE_ENV = "test"
    delete process.env.NEXT_PUBLIC_SVC_API_URL
    delete process.env.NEXT_PUBLIC_SVC_ROADMAP_URL
    vi.resetModules()

    await expect(import("./service-selector")).resolves.toHaveProperty(
      "RoadmapService"
    )
  }, 30_000)
})
