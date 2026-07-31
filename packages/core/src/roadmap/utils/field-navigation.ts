import type { Field, Roadmap } from "../types"

export type FieldRoadmapCta = {
  disabled: boolean
  href: string | null
  label: string
  reason: string | null
}

/**
 * Public navigation contract between Field Explorer, Field list, and canvas.
 * Only published roadmaps should be supplied by callers.
 */
export function fieldRoadmapCta(
  field: Field,
  roadmaps: Roadmap[]
): FieldRoadmapCta {
  if (roadmaps.length === 0) {
    return {
      disabled: true,
      href: null,
      label: "Chưa có roadmap",
      reason: "Lĩnh vực này chưa có roadmap đã xuất bản.",
    }
  }

  if (roadmaps.length === 1) {
    return {
      disabled: false,
      href: `/roadmaps/${roadmaps[0]!.id}`,
      label: "Khám phá roadmap",
      reason: null,
    }
  }

  return {
    disabled: false,
    href: `/fields/${encodeURIComponent(field.slug)}`,
    label: `Xem ${roadmaps.length} roadmap`,
    reason: null,
  }
}
