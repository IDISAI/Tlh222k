import type { PublishStatus } from "./publish-status"

export type FieldPolicyFailure =
  | "FIELD_TITLE_REQUIRED"
  | "FIELD_SLUG_REQUIRED"
  | "FIELD_DESCRIPTION_REQUIRED"
  | "FIELD_IMAGE_REQUIRED"
  | "FIELD_PUBLIC_BLOCK_REQUIRED"
  | "FIELD_NOT_DRAFT"

export type FieldPolicyResult =
  | { ok: true }
  | { ok: false; code: FieldPolicyFailure }

/** Rules shared by Workspace feedback and the server write boundary. */
export function fieldPublishEligibility(input: {
  title: string | null | undefined
  slug: string | null | undefined
  description: string | null | undefined
  imageUrl: string | null | undefined
  publicBlockCount: number
}): FieldPolicyResult {
  if (!input.title?.trim()) return { ok: false, code: "FIELD_TITLE_REQUIRED" }
  if (!input.slug?.trim()) return { ok: false, code: "FIELD_SLUG_REQUIRED" }
  if (!input.description?.trim()) {
    return { ok: false, code: "FIELD_DESCRIPTION_REQUIRED" }
  }
  if (!input.imageUrl?.trim().startsWith("https://")) {
    return { ok: false, code: "FIELD_IMAGE_REQUIRED" }
  }
  if (input.publicBlockCount < 1) {
    return { ok: false, code: "FIELD_PUBLIC_BLOCK_REQUIRED" }
  }
  return { ok: true }
}

export function fieldDeleteEligibility(status: PublishStatus): FieldPolicyResult {
  return status === "DRAFT" ? { ok: true } : { ok: false, code: "FIELD_NOT_DRAFT" }
}

/** Stable move used by pointer and keyboard reorder controls alike. */
export function reorderFieldMemberIds(
  ids: readonly string[],
  activeId: string,
  overId: string
): string[] {
  const from = ids.indexOf(activeId)
  const to = ids.indexOf(overId)
  if (from < 0 || to < 0 || from === to) return [...ids]
  const next = [...ids]
  next.splice(from, 1)
  next.splice(to, 0, activeId)
  return next
}

/** Blocks that disappear from every Field if this Field is removed. */
export function orphanedFieldMemberIds(
  deletingFieldId: string,
  memberships: readonly { fieldId: string; nodeId: string }[]
): string[] {
  const remaining = new Set(
    memberships.filter((membership) => membership.fieldId !== deletingFieldId).map((membership) => membership.nodeId)
  )
  return memberships
    .filter((membership) => membership.fieldId === deletingFieldId)
    .map((membership) => membership.nodeId)
    .filter((nodeId) => !remaining.has(nodeId))
}
