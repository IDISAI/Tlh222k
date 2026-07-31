import { describe, expect, it } from "vitest"

import {
  fieldDeleteEligibility,
  fieldPublishEligibility,
  orphanedFieldMemberIds,
  reorderFieldMemberIds,
} from "./field-policy"

describe("Field policy", () => {
  const complete = {
    title: "Artificial Intelligence",
    slug: "ai",
    description: "Learn AI foundations.",
    imageUrl: "https://cdn.example.com/ai.webp",
    publicBlockCount: 1,
  }

  it("names the first missing publishing requirement", () => {
    expect(fieldPublishEligibility({ ...complete, description: "" })).toEqual({ ok: false, code: "FIELD_DESCRIPTION_REQUIRED" })
    expect(fieldPublishEligibility({ ...complete, imageUrl: "http://example.com/ai.jpg" })).toEqual({ ok: false, code: "FIELD_IMAGE_REQUIRED" })
    expect(fieldPublishEligibility({ ...complete, publicBlockCount: 0 })).toEqual({ ok: false, code: "FIELD_PUBLIC_BLOCK_REQUIRED" })
    expect(fieldPublishEligibility(complete)).toEqual({ ok: true })
  })

  it("only permits deleting Draft Fields", () => {
    expect(fieldDeleteEligibility("DRAFT")).toEqual({ ok: true })
    expect(fieldDeleteEligibility("PUBLISHED")).toEqual({ ok: false, code: "FIELD_NOT_DRAFT" })
    expect(fieldDeleteEligibility("PRIVATE")).toEqual({ ok: false, code: "FIELD_NOT_DRAFT" })
  })

  it("refuses to delete a Field that still holds roadmaps", () => {
    expect(fieldDeleteEligibility("DRAFT", 1)).toEqual({ ok: false, code: "FIELD_STILL_HAS_ROADMAPS" })
    expect(fieldDeleteEligibility("DRAFT", 0)).toEqual({ ok: true })
  })

  it("reports the lifecycle problem first when a Field fails both rules", () => {
    // Telling an admin to empty a Published Field would send them down a path
    // that still ends in a refusal.
    expect(fieldDeleteEligibility("PUBLISHED", 3)).toEqual({ ok: false, code: "FIELD_NOT_DRAFT" })
  })

  it("moves one Field order without touching another", () => {
    expect(reorderFieldMemberIds(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"])
    expect(reorderFieldMemberIds(["a", "b", "c"], "missing", "a")).toEqual(["a", "b", "c"])
  })

  it("identifies only blocks orphaned by a Field deletion", () => {
    expect(orphanedFieldMemberIds("ai", [
      { fieldId: "ai", nodeId: "shared" },
      { fieldId: "data", nodeId: "shared" },
      { fieldId: "ai", nodeId: "only-ai" },
    ])).toEqual(["only-ai"])
  })
})
