import { describe, expect, it } from "vitest"

import {
  DISCOVERABILITY_LABELS,
  entitlementLabel,
  LIFECYCLE_LABELS,
  roadmapStateSummary,
} from "./access-labels"

describe("entitlementLabel", () => {
  it("names the two entitlements the contract allows", () => {
    expect(entitlementLabel("FREE")).toBe("Miễn phí")
    expect(entitlementLabel("INTERNAL")).toBe("Dành cho học viên AIO")
  })

  it("never says Premium, which is reserved until billing exists", () => {
    const every = [entitlementLabel("FREE"), entitlementLabel("INTERNAL")]
    expect(every.join(" ")).not.toMatch(/premium/i)
  })

  it("falls back to the free label on unknown input", () => {
    // Matches normalizeRoadmapVisibility, which reads absent data as FREE so
    // pre-existing content keeps working.
    expect(entitlementLabel("nonsense")).toBe("Miễn phí")
  })
})

describe("roadmapStateSummary", () => {
  it("describes a listed free roadmap by its entitlement alone", () => {
    expect(
      roadmapStateSummary({
        lifecycleStatus: "PUBLISHED",
        discoverability: "PUBLIC",
        visibility: "FREE",
      })
    ).toEqual({
      badge: "Miễn phí",
      listed: true,
      openable: true,
      notes: [],
    })
  })

  it("flags an unlisted roadmap as reachable only by link", () => {
    const summary = roadmapStateSummary({
      lifecycleStatus: "PUBLISHED",
      discoverability: "PRIVATE",
      visibility: "FREE",
    })
    expect(summary.listed).toBe(false)
    expect(summary.openable).toBe(true)
    expect(summary.notes).toContain("Chỉ mở được bằng đường dẫn trực tiếp")
  })

  it("treats a draft as closed regardless of the other two axes", () => {
    const summary = roadmapStateSummary({
      lifecycleStatus: "DRAFT",
      discoverability: "PUBLIC",
      visibility: "FREE",
    })
    expect(summary.listed).toBe(false)
    expect(summary.openable).toBe(false)
    expect(summary.notes).toContain("Bản nháp, người học chưa xem được")
  })

  it("keeps the entitlement note on an internal roadmap", () => {
    const summary = roadmapStateSummary({
      lifecycleStatus: "PUBLISHED",
      discoverability: "PUBLIC",
      visibility: "INTERNAL",
    })
    expect(summary.badge).toBe("Dành cho học viên AIO")
    expect(summary.listed).toBe(true)
    expect(summary.notes).toContain("Cần tài khoản AIO để mở")
  })

  it("reports every reason at once when a roadmap is draft, unlisted and internal", () => {
    const summary = roadmapStateSummary({
      lifecycleStatus: "DRAFT",
      discoverability: "PRIVATE",
      visibility: "INTERNAL",
    })
    expect(summary.notes).toHaveLength(3)
  })

  it("fails closed on unreadable state rather than showing it as public", () => {
    const summary = roadmapStateSummary({
      lifecycleStatus: null,
      discoverability: undefined as unknown as string,
      visibility: null,
    })
    expect(summary.listed).toBe(false)
    expect(summary.openable).toBe(false)
  })
})

describe("axis label maps", () => {
  it("covers every member of each axis", () => {
    expect(Object.keys(LIFECYCLE_LABELS)).toEqual(["DRAFT", "PUBLISHED"])
    expect(Object.keys(DISCOVERABILITY_LABELS)).toEqual(["PUBLIC", "PRIVATE"])
  })
})
