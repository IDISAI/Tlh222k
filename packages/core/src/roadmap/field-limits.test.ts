import { describe, expect, it } from "vitest"

import { normalizeFieldDescription } from "./field-limits"

describe("field descriptions", () => {
  describe("normalizeFieldDescription", () => {
    it("keeps a description that fits", () => {
      expect(normalizeFieldDescription("Khám phá Machine Learning")).toBe(
        "Khám phá Machine Learning"
      )
    })

    it("trims surrounding whitespace", () => {
      expect(normalizeFieldDescription("  Toán học  ")).toBe("Toán học")
    })

    it("keeps long descriptions intact", () => {
      const long = "x".repeat(600)
      expect(normalizeFieldDescription(long)).toBe(long)
    })

    it("treats a missing description as empty rather than failing", () => {
      // A Draft Field is allowed to have no description at all.
      expect(normalizeFieldDescription(null)).toBe("")
      expect(normalizeFieldDescription(undefined)).toBe("")
      expect(normalizeFieldDescription(42)).toBe("")
    })
  })
})
