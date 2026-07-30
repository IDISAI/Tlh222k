import { describe, expect, it } from "vitest"

import { validateRoadmapSlug } from "./slug-policy"

const taken = ["giai-tich", "dai-so-tuyen-tinh"]

describe("validateRoadmapSlug", () => {
  it("accepts a well-formed slug nobody holds", () => {
    expect(validateRoadmapSlug("toan-roi-rac", taken)).toEqual({ ok: true })
  })

  it("requires a value", () => {
    expect(validateRoadmapSlug("   ", taken)).toEqual({
      ok: false,
      code: "SLUG_REQUIRED",
    })
  })

  it("rejects characters that would not survive a URL", () => {
    expect(validateRoadmapSlug("Toán Học", taken).ok).toBe(false)
    expect(validateRoadmapSlug("a b", taken).ok).toBe(false)
    expect(validateRoadmapSlug("a/b", taken).ok).toBe(false)
    expect(validateRoadmapSlug("UPPER", taken)).toEqual({
      ok: false,
      code: "SLUG_INVALID",
    })
  })

  it("rejects leading, trailing and doubled separators", () => {
    expect(validateRoadmapSlug("-lead", taken).ok).toBe(false)
    expect(validateRoadmapSlug("trail-", taken).ok).toBe(false)
    expect(validateRoadmapSlug("a--b", taken).ok).toBe(false)
  })

  it("rejects a slug another roadmap already holds", () => {
    expect(validateRoadmapSlug("giai-tich", taken)).toEqual({
      ok: false,
      code: "SLUG_TAKEN",
    })
  })

  it("lets a roadmap keep its own slug while editing", () => {
    // Without this the edit form refuses to save any change, because the
    // roadmap's current slug is always already in the taken list.
    expect(validateRoadmapSlug("giai-tich", taken, "giai-tich")).toEqual({
      ok: true,
    })
  })

  it("compares case- and whitespace-insensitively against the taken list", () => {
    expect(validateRoadmapSlug("  giai-tich  ", taken)).toEqual({
      ok: false,
      code: "SLUG_TAKEN",
    })
  })
})
