/**
 * URL-safe slug from a (possibly Vietnamese) title. Diacritics are stripped so
 * "Lập trình Web" → "lap-trinh-web"; a random suffix keeps generated slugs
 * unique enough for mock data (real uniqueness is a backend concern).
 */
export function slugify(input: string, opts: { unique?: boolean } = {}): string {
  const base = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

  const slug = base || "node"
  return opts.unique ? `${slug}-${Math.random().toString(36).slice(2, 7)}` : slug
}
