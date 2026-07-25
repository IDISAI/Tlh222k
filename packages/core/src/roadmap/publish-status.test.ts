import { describe, expect, it } from "vitest"

import {
  PUBLISH_STATUSES,
  isPublishStatus,
  legacyIsPublished,
  normalizePublishStatus,
  publishStatusFromLegacy,
  reachesLearners,
} from "./publish-status"

describe("publish status", () => {
  it("offers exactly Draft, Published and Private", () => {
    expect([...PUBLISH_STATUSES]).toEqual(["DRAFT", "PUBLISHED", "PRIVATE"])
  })

  it("rejects the states this system deliberately does not have", () => {
    // No review step and no archive: nothing in the system approves content,
    // so a state naming an act nobody performs must not sneak back in.
    expect(isPublishStatus("PENDING")).toBe(false)
    expect(isPublishStatus("ARCHIVED")).toBe(false)
  })

  describe("normalizePublishStatus", () => {
    it("accepts the three states", () => {
      expect(normalizePublishStatus("PUBLISHED")).toBe("PUBLISHED")
      expect(normalizePublishStatus("PRIVATE")).toBe("PRIVATE")
      expect(normalizePublishStatus("DRAFT")).toBe("DRAFT")
    })

    it("accepts the loose casing a database or form may hand over", () => {
      expect(normalizePublishStatus("published")).toBe("PUBLISHED")
      expect(normalizePublishStatus("  Private ")).toBe("PRIVATE")
    })

    it("falls back to Draft for anything it does not recognise", () => {
      // Fail closed: an unreadable value must hide content, never expose it.
      expect(normalizePublishStatus("PUBLISHE")).toBe("DRAFT")
      expect(normalizePublishStatus("")).toBe("DRAFT")
      expect(normalizePublishStatus(null)).toBe("DRAFT")
      expect(normalizePublishStatus(undefined)).toBe("DRAFT")
      expect(normalizePublishStatus(42)).toBe("DRAFT")
    })
  })

  describe("reachesLearners", () => {
    it("is true only for Published", () => {
      // One rule on every surface: Published is seen, Draft and Private are
      // not. No screen gets to make its own exception.
      expect(reachesLearners("PUBLISHED")).toBe(true)
      expect(reachesLearners("DRAFT")).toBe(false)
      expect(reachesLearners("PRIVATE")).toBe(false)
    })
  })

  describe("translating the legacy boolean", () => {
    it("maps a published row to Published and everything else to Draft", () => {
      expect(publishStatusFromLegacy(true)).toBe("PUBLISHED")
      expect(publishStatusFromLegacy(false)).toBe("DRAFT")
    })

    it("maps back so a linked document stays in step", () => {
      expect(legacyIsPublished("PUBLISHED")).toBe(true)
      expect(legacyIsPublished("DRAFT")).toBe(false)
      expect(legacyIsPublished("PRIVATE")).toBe(false)
    })

    it("round-trips the boolean without drift", () => {
      for (const value of [true, false]) {
        expect(legacyIsPublished(publishStatusFromLegacy(value))).toBe(value)
      }
    })

    it("collapses Private to unpublished, losing the distinction on purpose", () => {
      // Documents keep a boolean this round, so a Private block reads as
      // unpublished on that side. Round-tripping through the boolean is
      // therefore lossy, and callers must not use it to persist a block.
      expect(publishStatusFromLegacy(legacyIsPublished("PRIVATE"))).toBe("DRAFT")
    })
  })
})
