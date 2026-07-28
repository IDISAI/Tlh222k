import { describe, expect, it } from "vitest"

import {
  FIELD_DESCRIPTION_MAX,
  FIELD_DESCRIPTION_WARN,
  normalizeFieldDescription,
} from "./field-limits"

describe("field description limits", () => {
  it("caps at the length the Explorer hero can hold", () => {
    expect(FIELD_DESCRIPTION_MAX).toBe(160)
  })

  it("warns before the cap, not at it", () => {
    // Warning at the cap tells an editor about a wall they have already hit.
    expect(FIELD_DESCRIPTION_WARN).toBeLessThan(FIELD_DESCRIPTION_MAX)
  })

  describe("normalizeFieldDescription", () => {
    it("keeps a description that fits", () => {
      expect(normalizeFieldDescription("Khám phá Machine Learning")).toBe(
        "Khám phá Machine Learning"
      )
    })

    it("trims surrounding whitespace", () => {
      expect(normalizeFieldDescription("  Toán học  ")).toBe("Toán học")
    })

    it("cuts anything past the cap", () => {
      // The form's maxLength only stops a person typing. An API caller is not
      // typing, so the cap has to hold on the way in as well.
      const long = "x".repeat(600)
      expect(normalizeFieldDescription(long)).toHaveLength(FIELD_DESCRIPTION_MAX)
    })

    it("treats a missing description as empty rather than failing", () => {
      // A Draft Field is allowed to have no description at all.
      expect(normalizeFieldDescription(null)).toBe("")
      expect(normalizeFieldDescription(undefined)).toBe("")
      expect(normalizeFieldDescription(42)).toBe("")
    })
  })
})
