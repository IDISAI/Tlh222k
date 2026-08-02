import {
  normalizeDiscoverability,
  normalizeLifecycleStatus,
  normalizeRoadmapVisibility,
  type Discoverability,
  type LifecycleStatus,
  type RoadmapAccessRecord,
  type RoadmapVisibility,
} from "./access-policy"

/**
 * The Vietnamese wording for each axis, in one place.
 *
 * The CMS and the public card previously each spelled these out, and drifted:
 * the card said "Nội bộ" where the create dialog said "Nội bộ AIO", and the
 * contract asks for neither. Naming an entitlement is a product decision, not
 * a per-component one — "Premium" in particular is reserved until a billing
 * entitlement exists, because today INTERNAL means an AIO account, not a
 * purchase, and calling it Premium promises a checkout that isn't there.
 */
export const LIFECYCLE_LABELS: Record<LifecycleStatus, string> = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã xuất bản",
}

export const DISCOVERABILITY_LABELS: Record<Discoverability, string> = {
  PUBLIC: "Hiển thị trong danh sách",
  PRIVATE: "Không hiện trong danh sách",
}

export const ENTITLEMENT_LABELS: Record<RoadmapVisibility, string> = {
  FREE: "Miễn phí",
  INTERNAL: "Dành cho học viên AIO",
}

/** The badge a public card shows. Unknown data reads as FREE, as elsewhere. */
export function entitlementLabel(raw: unknown): string {
  return ENTITLEMENT_LABELS[normalizeRoadmapVisibility(raw)]
}

export interface RoadmapStateSummary {
  /** The one word the public card puts on the cover. */
  badge: string
  /** Whether the roadmap appears in listings and search. */
  listed: boolean
  /** Whether a direct link opens it for someone with the entitlement. */
  openable: boolean
  /**
   * Everything about this state a CMS editor would otherwise have to infer by
   * cross-referencing three dropdowns. Empty for a plainly public roadmap.
   */
  notes: string[]
}

/**
 * Restate the three axes as the two questions an editor actually asks — can
 * people find it, and can people open it — plus the reasons behind each answer.
 *
 * Deliberately not a single status enum: the axes are independent, so a
 * roadmap can be published-but-unlisted, or listed-but-gated, and collapsing
 * that into one label is what the contract forbids.
 */
export function roadmapStateSummary(
  record: RoadmapAccessRecord
): RoadmapStateSummary {
  const lifecycle = normalizeLifecycleStatus(record.lifecycleStatus)
  const discoverability = normalizeDiscoverability(record.discoverability)
  const visibility = normalizeRoadmapVisibility(record.visibility)

  const notes: string[] = []
  if (lifecycle !== "PUBLISHED") {
    notes.push("Bản nháp, người học chưa xem được")
  }
  if (discoverability === "PRIVATE") {
    notes.push("Chỉ mở được bằng đường dẫn trực tiếp")
  }
  if (visibility === "INTERNAL") {
    notes.push("Cần tài khoản AIO để mở")
  }

  const openable = lifecycle === "PUBLISHED"
  return {
    badge: ENTITLEMENT_LABELS[visibility],
    listed: openable && discoverability === "PUBLIC",
    openable,
    notes,
  }
}
