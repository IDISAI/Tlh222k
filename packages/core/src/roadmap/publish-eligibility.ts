export type PublishBlocker =
  | "TITLE_REQUIRED"
  | "SLUG_REQUIRED"
  | "DESCRIPTION_REQUIRED"
  | "FIELD_REQUIRED"
  | "COVER_REQUIRED"
  | "CONTENT_REQUIRED"
  | "DELETED_CONTENT_REFERENCED"

export type PublishEligibility =
  | { ok: true }
  | { ok: false; code: PublishBlocker }

export interface PublishCandidate {
  title: string | null | undefined
  slug: string | null | undefined
  description: string | null | undefined
  fieldCount: number
  coverUrl: string | null | undefined
  /** Nodes this roadmap requires — a roadmap with none has nothing to learn. */
  requiredNodeCount: number
  /** Whether the composition still points at content that has been deleted. */
  referencesDeletedContent: boolean
}

/**
 * What a roadmap needs before it can face learners.
 *
 * Checked in a fixed order and reported one at a time. A list of six problems
 * reads as "this is far off" when usually one field is blank — and the editor
 * fixes them one at a time regardless.
 *
 * The cover must be https. An `http:` cover is a mixed-content block on a
 * secure page (an invisible failure: the card renders with a hole), and a
 * `javascript:` one is a script waiting for someone to click it.
 */
export function roadmapPublishEligibility(
  candidate: PublishCandidate
): PublishEligibility {
  if (!candidate.title?.trim()) return { ok: false, code: "TITLE_REQUIRED" }
  if (!candidate.slug?.trim()) return { ok: false, code: "SLUG_REQUIRED" }
  if (!candidate.description?.trim()) {
    return { ok: false, code: "DESCRIPTION_REQUIRED" }
  }
  if (candidate.fieldCount < 1) return { ok: false, code: "FIELD_REQUIRED" }
  if (!candidate.coverUrl?.trim().toLowerCase().startsWith("https://")) {
    return { ok: false, code: "COVER_REQUIRED" }
  }
  if (candidate.requiredNodeCount < 1) {
    return { ok: false, code: "CONTENT_REQUIRED" }
  }
  if (candidate.referencesDeletedContent) {
    return { ok: false, code: "DELETED_CONTENT_REFERENCED" }
  }
  return { ok: true }
}

export const PUBLISH_BLOCKER_MESSAGES: Record<PublishBlocker, string> = {
  TITLE_REQUIRED: "Cần có tiêu đề trước khi xuất bản.",
  SLUG_REQUIRED: "Cần có đường dẫn trước khi xuất bản.",
  DESCRIPTION_REQUIRED: "Cần có mô tả trước khi xuất bản.",
  FIELD_REQUIRED: "Roadmap phải thuộc ít nhất một lĩnh vực.",
  COVER_REQUIRED: "Cần ảnh bìa (đường dẫn https).",
  CONTENT_REQUIRED: "Roadmap phải có ít nhất một nội dung bắt buộc.",
  DELETED_CONTENT_REFERENCED:
    "Roadmap còn trỏ tới nội dung đã xoá. Gỡ nội dung đó khỏi canvas trước.",
}

/** Whether removing a roadmap destroys it or files it away. */
export type DeleteDisposition = "DELETE" | "ARCHIVE"

/**
 * A roadmap is only truly deleted while nobody could miss it.
 *
 * Once it has been published its URL may be linked from outside this system,
 * and once a learner has touched it their progress hangs off its nodes.
 * Either way the honest move is to archive — reversible — rather than destroy.
 */
export function roadmapDeleteDisposition(input: {
  everPublished: boolean
  hasLearnerData: boolean
}): DeleteDisposition {
  return input.everPublished || input.hasLearnerData ? "ARCHIVE" : "DELETE"
}
