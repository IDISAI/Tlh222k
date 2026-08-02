export type SlugFailure = "SLUG_REQUIRED" | "SLUG_INVALID" | "SLUG_TAKEN"

export type SlugValidation = { ok: true } | { ok: false; code: SlugFailure }

/**
 * Lowercase words joined by single hyphens. Anything else either breaks the
 * canonical `/roadmaps/[slug]` URL or produces two slugs that look identical
 * in a list but route differently.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Guard the one field a roadmap's public URL is built from.
 *
 * `currentSlug` is what makes this usable from an edit form: a roadmap's own
 * slug is always present in the taken list, so without it every save of an
 * unchanged slug would be refused as a duplicate.
 */
export function validateRoadmapSlug(
  raw: string | null | undefined,
  takenSlugs: readonly string[],
  currentSlug?: string | null
): SlugValidation {
  // Trim but do not lowercase. Surrounding whitespace is invisible and never
  // intended, so silently dropping it surprises nobody. Case is visible and
  // is part of the URL — quietly rewriting "Toan-Hoc" to "toan-hoc" would save
  // something other than what the editor sees in the field. Reject instead and
  // let the form offer to fix it.
  const slug = (raw ?? "").trim()
  if (!slug) return { ok: false, code: "SLUG_REQUIRED" }
  if (!SLUG_PATTERN.test(slug)) return { ok: false, code: "SLUG_INVALID" }

  // Uniqueness is still case-insensitive: two slugs differing only in case
  // would collide in any sane URL scheme even though the pattern above already
  // makes one of them unreachable.
  const folded = slug.toLowerCase()
  const own = (currentSlug ?? "").trim().toLowerCase()
  if (own && folded === own) return { ok: true }

  const taken = takenSlugs.some(
    (candidate) => candidate.trim().toLowerCase() === folded
  )
  return taken ? { ok: false, code: "SLUG_TAKEN" } : { ok: true }
}

export const SLUG_FAILURE_MESSAGES: Record<SlugFailure, string> = {
  SLUG_REQUIRED: "Đường dẫn không được để trống.",
  SLUG_INVALID:
    "Đường dẫn chỉ gồm chữ thường, số và dấu gạch ngang đơn, ví dụ: dai-so-tuyen-tinh.",
  SLUG_TAKEN: "Đường dẫn này đã có roadmap khác dùng.",
}
