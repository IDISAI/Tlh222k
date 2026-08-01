import { describe, expect, it } from "vitest"

import type { Field, Roadmap } from "../types"
import { fieldRoadmapCta } from "./field-navigation"

const field: Field = {
  id: "field-ai",
  title: "Artificial Intelligence",
  slug: "ai",
  order: 0,
  description: "AI learning paths",
  imageUrl: "https://example.com/ai.jpg",
  publishStatus: "PUBLISHED",
}

function roadmap(id: string): Roadmap {
  return {
    id,
    slug: id,
    title: id,
    description: null,
    thumbnailUrl: null,
    publishStatus: "PUBLISHED",
    nodeCount: 0,
    fields: [field],
  }
}

describe("fieldRoadmapCta", () => {
  it("disables exploration when a Field has no published roadmap", () => {
    expect(fieldRoadmapCta(field, [])).toEqual({
      disabled: true,
      href: null,
      label: "Chưa có roadmap",
      reason: "Lĩnh vực này chưa có roadmap đã xuất bản.",
    })
  })

  it("opens Field Explorer when one roadmap is available", () => {
    expect(fieldRoadmapCta(field, [roadmap("rm-ai")])).toEqual({
      disabled: false,
      href: "/fields/ai",
      label: "Khám phá roadmap",
      reason: null,
    })
  })

  it("opens the Field list when more than one roadmap is available", () => {
    expect(
      fieldRoadmapCta(field, [roadmap("rm-ai"), roadmap("rm-ml")])
    ).toEqual({
      disabled: false,
      href: "/fields/ai",
      label: "Xem 2 roadmap",
      reason: null,
    })
  })
})
