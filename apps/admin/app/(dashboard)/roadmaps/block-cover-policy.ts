const MAX_FILE_BYTES = 3 * 1024 * 1024

export type BlockCoverDecision =
  | { ok: true; contentType: "image/jpeg" | "image/webp" | "image/png"; sanitizedName: string }
  | { ok: false; code: "NO_FILE" | "FILE_TOO_LARGE" | "UNSUPPORTED_FILE_TYPE" }

export function sanitizeBlockCoverName(name: string): string {
  const base = name.replaceAll("\\", "/").split("/").at(-1) ?? ""
  const value = base.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120)
  return value || "block-cover"
}

/**
 * A block cover only ever renders small (table thumbnail, picker card,
 * canvas card), always `background-size: cover`, so no dimension or aspect
 * ratio gate here either — same reasoning as `inspectFieldImage`.
 */
export function inspectBlockCoverImage(file: { name: string; size: number; type: string; width?: number; height?: number }): BlockCoverDecision {
  if (file.size <= 0) return { ok: false, code: "NO_FILE" }
  if (file.size > MAX_FILE_BYTES) return { ok: false, code: "FILE_TOO_LARGE" }
  const contentType = file.type.trim().toLowerCase() as "image/jpeg" | "image/webp" | "image/png"
  if (contentType !== "image/jpeg" && contentType !== "image/webp" && contentType !== "image/png") {
    return { ok: false, code: "UNSUPPORTED_FILE_TYPE" }
  }
  return { ok: true, contentType, sanitizedName: sanitizeBlockCoverName(file.name) }
}
