import { describe, expect, it } from "vitest"

import {
  DISCOVERABILITIES,
  LIFECYCLE_STATUSES,
  canListRoadmap,
  canOpenRoadmap,
  normalizeDiscoverability,
  normalizeLifecycleStatus,
  type RoadmapAccessActor,
} from "./access-policy"

const guest: RoadmapAccessActor = {
  authenticated: false,
  role: "guest",
}

describe("roadmap access policy", () => {
  it("keeps lifecycle and discoverability independent", () => {
    expect([...LIFECYCLE_STATUSES]).toEqual(["DRAFT", "PUBLISHED"])
    expect([...DISCOVERABILITIES]).toEqual(["PUBLIC", "PRIVATE"])
    expect(normalizeLifecycleStatus("private")).toBe("DRAFT")
    expect(normalizeDiscoverability("private")).toBe("PRIVATE")
  })

  it("lets a guest open a published private free roadmap by direct link", () => {
    const roadmap = {
      lifecycleStatus: "PUBLISHED",
      discoverability: "PRIVATE",
      visibility: "FREE",
    } as const

    expect(canOpenRoadmap(roadmap, guest)).toBe(true)
    expect(canListRoadmap(roadmap, guest)).toBe(false)
  })

  it("never exposes a draft outside CMS", () => {
    const roadmap = {
      lifecycleStatus: "DRAFT",
      discoverability: "PUBLIC",
      visibility: "FREE",
    } as const

    expect(canOpenRoadmap(roadmap, guest)).toBe(false)
    expect(canOpenRoadmap(roadmap, { authenticated: true, role: "aio" })).toBe(
      false
    )
    expect(
      canOpenRoadmap(roadmap, { authenticated: true, role: "admin" })
    ).toBe(true)
  })

  it("requires AIO or admin entitlement for INTERNAL", () => {
    const roadmap = {
      lifecycleStatus: "PUBLISHED",
      discoverability: "PUBLIC",
      visibility: "INTERNAL",
    } as const

    expect(canOpenRoadmap(roadmap, guest)).toBe(false)
    expect(
      canOpenRoadmap(roadmap, { authenticated: true, role: "viewer" })
    ).toBe(false)
    expect(
      canOpenRoadmap(roadmap, { authenticated: true, role: "aio" })
    ).toBe(true)
    expect(
      canOpenRoadmap(roadmap, { authenticated: true, role: "admin" })
    ).toBe(true)
    expect(
      canOpenRoadmap(roadmap, { authenticated: true, role: "super_admin" })
    ).toBe(true)
  })
})
