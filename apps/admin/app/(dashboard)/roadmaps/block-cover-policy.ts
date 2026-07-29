const MAX_FILE_BYTES = 3 * 1024 * 1024
const MIN_WIDTH = 320
const MIN_HEIGHT = 240

export type BlockCoverDecision =
  | { ok: true; contentType: "image/jpeg" | "image/webp" | "image/png"; sanitizedName: string }
  | { ok: false; code: "NO_FILE" | "FILE_TOO_LARGE" | "UNSUPPORTED_FILE_TYPE" | "INVALID_DIMENSIONS" }

export function sanitizeBlockCoverName(name: string): string {
  const base = name.replaceAll("\\", "/").split("/").at(-1) ?? ""
  const value = base.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120)
  return value || "block-cover"
}

/**
 * A block cover only ever renders small (table thumbnail, picker card,
 * canvas card) — no full-viewport use like a Field's image — so this stays
 * far looser than `inspectFieldImage` and enforces no aspect ratio.
 */
export function inspectBlockCoverImage(file: { name: string; size: number; type: string; width?: number; height?: number }): BlockCoverDecision {
  if (file.size <= 0) return { ok: false, code: "NO_FILE" }
  if (file.size > MAX_FILE_BYTES) return { ok: false, code: "FILE_TOO_LARGE" }
  const contentType = file.type.trim().toLowerCase() as "image/jpeg" | "image/webp" | "image/png"
  if (contentType !== "image/jpeg" && contentType !== "image/webp" && contentType !== "image/png") {
    return { ok: false, code: "UNSUPPORTED_FILE_TYPE" }
  }
  if (file.width !== undefined && file.height !== undefined && (file.width < MIN_WIDTH || file.height < MIN_HEIGHT)) {
    return { ok: false, code: "INVALID_DIMENSIONS" }
  }
  return { ok: true, contentType, sanitizedName: sanitizeBlockCoverName(file.name) }
}
