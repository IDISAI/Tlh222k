import { describe, expect, it } from "vitest"

import {
  roadmapDeleteDisposition,
  roadmapPublishEligibility,
} from "./publish-eligibility"

const complete = {
  title: "Đại số tuyến tính",
  slug: "dai-so-tuyen-tinh",
  description: "Vector, ma trận, trị riêng.",
  fieldCount: 1,
  coverUrl: "https://cdn.example/cover.jpg",
  requiredNodeCount: 3,
  referencesDeletedContent: false,
}

describe("roadmapPublishEligibility", () => {
  it("passes a complete roadmap", () => {
    expect(roadmapPublishEligibility(complete)).toEqual({ ok: true })
  })

  it("requires each field the contract names", () => {
    expect(roadmapPublishEligibility({ ...complete, title: "  " })).toEqual({
      ok: false,
      code: "TITLE_REQUIRED",
    })
    expect(roadmapPublishEligibility({ ...complete, slug: "" })).toEqual({
      ok: false,
      code: "SLUG_REQUIRED",
    })
    expect(
      roadmapPublishEligibility({ ...complete, description: null })
    ).toEqual({ ok: false, code: "DESCRIPTION_REQUIRED" })
    expect(roadmapPublishEligibility({ ...complete, fieldCount: 0 })).toEqual({
      ok: false,
      code: "FIELD_REQUIRED",
    })
    expect(roadmapPublishEligibility({ ...complete, coverUrl: null })).toEqual({
      ok: false,
      code: "COVER_REQUIRED",
    })
    expect(
      roadmapPublishEligibility({ ...complete, requiredNodeCount: 0 })
    ).toEqual({ ok: false, code: "CONTENT_REQUIRED" })
  })

  it("refuses to publish a roadmap pointing at deleted content", () => {
    // Publishing a dangling reference puts a dead door on a public canvas.
    expect(
      roadmapPublishEligibility({ ...complete, referencesDeletedContent: true })
    ).toEqual({ ok: false, code: "DELETED_CONTENT_REFERENCED" })
  })

  it("rejects a cover that is not an https URL", () => {
    expect(
      roadmapPublishEligibility({ ...complete, coverUrl: "javascript:alert(1)" })
    ).toEqual({ ok: false, code: "COVER_REQUIRED" })
    expect(
      roadmapPublishEligibility({ ...complete, coverUrl: "http://cdn/x.jpg" })
    ).toEqual({ ok: false, code: "COVER_REQUIRED" })
  })

  it("reports the first missing piece, so the editor fixes one thing at a time", () => {
    expect(
      roadmapPublishEligibility({
        ...complete,
        title: "",
        slug: "",
        description: "",
      })
    ).toEqual({ ok: false, code: "TITLE_REQUIRED" })
  })
})

describe("roadmapDeleteDisposition", () => {
  it("deletes a never-published draft nobody has touched", () => {
    expect(
      roadmapDeleteDisposition({ everPublished: false, hasLearnerData: false })
    ).toBe("DELETE")
  })

  it("archives anything that was ever published", () => {
    // A published URL may be linked from outside; destroying it turns those
    // links into 404s with no way back.
    expect(
      roadmapDeleteDisposition({ everPublished: true, hasLearnerData: false })
    ).toBe("ARCHIVE")
  })

  it("archives a draft that already carries learner data", () => {
    expect(
      roadmapDeleteDisposition({ everPublished: false, hasLearnerData: true })
    ).toBe("ARCHIVE")
  })
})
