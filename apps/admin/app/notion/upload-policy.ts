const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

const ALLOWED_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/plain;charset=utf-8",
])

export type UploadDecision =
  | { ok: true; sanitizedName: string; contentType: string }
  | {
      ok: false
      code: "NO_FILE" | "FILE_TOO_LARGE" | "UNSUPPORTED_FILE_TYPE"
    }

export interface UploadMetadata {
  name: string
  size: number
  type: string
}

export function sanitizeBaseName(name: string): string {
  const baseName = name.replaceAll("\\", "/").split("/").at(-1) ?? ""
  const sanitized = baseName
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
  return sanitized || "upload"
}

export function inspectUpload(file: UploadMetadata): UploadDecision {
  if (file.size <= 0) return { ok: false, code: "NO_FILE" }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, code: "FILE_TOO_LARGE" }
  }

  const contentType = file.type.trim().toLowerCase().replace(/;\s+/g, ";")
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return { ok: false, code: "UNSUPPORTED_FILE_TYPE" }
  }

  return {
    ok: true,
    contentType,
    sanitizedName: sanitizeBaseName(file.name),
  }
}
