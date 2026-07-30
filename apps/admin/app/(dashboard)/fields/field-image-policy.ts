const MAX_FILE_BYTES = 2 * 1024 * 1024

export type FieldImageDecision =
  | { ok: true; contentType: "image/jpeg" | "image/webp"; sanitizedName: string }
  | { ok: false; code: "NO_FILE" | "FILE_TOO_LARGE" | "UNSUPPORTED_FILE_TYPE" }

export function sanitizeFieldImageName(name: string): string {
  const base = name.replaceAll("\\", "/").split("/").at(-1) ?? ""
  const value = base.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120)
  return value || "field-image"
}

/**
 * No dimension or aspect-ratio gate: every surface that renders a Field's
 * image (`background-size: cover`, on the Explorer scene and the thumbnail
 * strip alike) already crops whatever is uploaded to fill its box, so
 * gating on 3:2/2400×1600 only rejected perfectly good images without
 * making the render any better.
 */
export function inspectFieldImage(file: { name: string; size: number; type: string; width?: number; height?: number }): FieldImageDecision {
  if (file.size <= 0) return { ok: false, code: "NO_FILE" }
  if (file.size > MAX_FILE_BYTES) return { ok: false, code: "FILE_TOO_LARGE" }
  const contentType = file.type.trim().toLowerCase() as "image/jpeg" | "image/webp"
  if (contentType !== "image/jpeg" && contentType !== "image/webp") return { ok: false, code: "UNSUPPORTED_FILE_TYPE" }
  return { ok: true, contentType, sanitizedName: sanitizeFieldImageName(file.name) }
}
