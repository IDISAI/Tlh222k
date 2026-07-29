const MAX_FILE_BYTES = 2 * 1024 * 1024
const MIN_WIDTH = 2400
const MIN_HEIGHT = 1600
const ASPECT_RATIO = 3 / 2

export type FieldImageDecision =
  | { ok: true; contentType: "image/jpeg" | "image/webp"; sanitizedName: string }
  | { ok: false; code: "NO_FILE" | "FILE_TOO_LARGE" | "UNSUPPORTED_FILE_TYPE" | "INVALID_DIMENSIONS" }

export function sanitizeFieldImageName(name: string): string {
  const base = name.replaceAll("\\", "/").split("/").at(-1) ?? ""
  const value = base.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120)
  return value || "field-image"
}

export function inspectFieldImage(file: { name: string; size: number; type: string; width?: number; height?: number }): FieldImageDecision {
  if (file.size <= 0) return { ok: false, code: "NO_FILE" }
  if (file.size > MAX_FILE_BYTES) return { ok: false, code: "FILE_TOO_LARGE" }
  const contentType = file.type.trim().toLowerCase() as "image/jpeg" | "image/webp"
  if (contentType !== "image/jpeg" && contentType !== "image/webp") return { ok: false, code: "UNSUPPORTED_FILE_TYPE" }
  if (file.width !== undefined && file.height !== undefined && (file.width < MIN_WIDTH || file.height < MIN_HEIGHT || Math.abs(file.width / file.height - ASPECT_RATIO) > 0.015)) {
    return { ok: false, code: "INVALID_DIMENSIONS" }
  }
  return { ok: true, contentType, sanitizedName: sanitizeFieldImageName(file.name) }
}
