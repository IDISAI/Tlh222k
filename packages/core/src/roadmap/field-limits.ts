/**
 * A Field's description is the subtitle a learner reads over its full-viewport
 * image on the Explorer. It is capped because that scene has room for a
 * sentence, not a paragraph — past the cap the copy either overflows the hero
 * or gets silently clipped, and neither is something an editor can see coming
 * from inside the CMS.
 */
export const FIELD_DESCRIPTION_MAX = 160

/**
 * Where the counter starts warning. Early enough that an editor still has room
 * to rewrite rather than discovering the limit mid-word.
 */
export const FIELD_DESCRIPTION_WARN = 150

/** Trim and cap in one place, so the server and the form agree on the answer. */
export function normalizeFieldDescription(raw: unknown): string {
  if (typeof raw !== "string") return ""
  return raw.trim().slice(0, FIELD_DESCRIPTION_MAX)
}
