/**
 * URL-safe slug from a (possibly Vietnamese) title. Diacritics are stripped so
 * "Lập trình Web" → "lap-trinh-web". Empty/special-only input falls back to
 * "untitled" (notion-article-node Req 9.1). Slugs are immutable after creation
 * (Req 9.5); this function never runs on title updates.
 */
export function slugify(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
  return base || "untitled"
}

/**
 * Deterministic uniqueness: `base`, then `base-2` .. `base-999`
 * (notion-article-node Req 9.2). `exists` answers "is this slug taken?".
 */
export function uniqueSlug(base: string, exists: (slug: string) => boolean): string {
  if (!exists(base)) return base
  for (let n = 2; n <= 999; n++) {
    const candidate = `${base}-${n}`
    if (!exists(candidate)) return candidate
  }
  throw new Error(`uniqueSlug: exhausted suffixes for "${base}"`)
}
