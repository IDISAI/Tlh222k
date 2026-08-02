import { describe, expect, it } from "vitest"

import { LEVELS, LEVEL_LABELS, isLevel, normalizeLevel } from "./level"

describe("level", () => {
  it("offers exactly three, easiest first", () => {
    // The order is the order a learner would take them, so any UI that lists
    // levels can iterate this rather than inventing its own sequence.
    expect([...LEVELS]).toEqual(["BASIC", "INTERMEDIATE", "ADVANCED"])
  })

  it("labels each one in the language the CMS is written in", () => {
    expect(LEVEL_LABELS.BASIC).toBe("Cơ bản")
    expect(LEVEL_LABELS.INTERMEDIATE).toBe("Trung cấp")
    expect(LEVEL_LABELS.ADVANCED).toBe("Nâng cao")
  })

  it("recognises its own values and nothing else", () => {
    expect(isLevel("BASIC")).toBe(true)
    expect(isLevel("EXPERT")).toBe(false)
    expect(isLevel("Cơ bản")).toBe(false)
  })

  describe("normalizeLevel", () => {
    it("accepts the loose casing a form or database may hand over", () => {
      expect(normalizeLevel("basic")).toBe("BASIC")
      expect(normalizeLevel(" Advanced ")).toBe("ADVANCED")
    })

    it("returns null rather than guessing", () => {
      // A block without a level is a real state - it says "nobody has judged
      // this yet". Defaulting to Cơ bản would put a judgement in an editor's
      // mouth that they never made.
      expect(normalizeLevel("EXPERT")).toBeNull()
      expect(normalizeLevel("")).toBeNull()
      expect(normalizeLevel(null)).toBeNull()
      expect(normalizeLevel(undefined)).toBeNull()
      expect(normalizeLevel(3)).toBeNull()
    })
  })
})
