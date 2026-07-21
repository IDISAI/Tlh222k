// Domain layer — text normalization for slugs and outbound URLs. Pure.
import { DomainError } from "./errors"

/**
 * Reject anything that isn't a plain http(s) URL. Blocks stored-XSS vectors
 * like `javascript:` / `data:` that would fire if the value is ever rendered
 * as a link href. Empty/undefined → null (field is optional).
 */
export function normalizeHttpUrl(
  raw: string | null | undefined
): string | null {
  const v = raw?.trim()
  if (!v) return null
  let url: URL
  try {
    url = new URL(v)
  } catch {
    throw new DomainError("INVALID_URL")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new DomainError("INVALID_URL")
  }
  return url.toString()
}

/**
 * URL-safe slug (Vietnamese diacritics stripped), matching the core util.
 * Empty/special-only input falls back to "untitled" (notion-article-node
 * Req 9.1). Uniqueness is a deterministic `-{n}` suffix (Req 9.2) resolved by
 * the application layer, not here.
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
