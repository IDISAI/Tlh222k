export type AttachmentRejection =
  | "NO_FILE"
  | "FILE_TOO_LARGE"
  | "EXECUTABLE_REJECTED"
  | "UNSUPPORTED_FILE_TYPE"

export type AttachmentDecision =
  | { ok: true; contentType: string; sanitizedName: string }
  | { ok: false; code: AttachmentRejection }

const MAX_BYTES = 50 * 1024 * 1024

/** Images, PDFs and office documents — what the contract permits. */
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
])

/**
 * Anything the operating system might run. Checked as a set of extensions
 * rather than a pattern because the list is what matters and a pattern invites
 * a near-miss.
 */
const EXECUTABLE_EXTENSIONS = new Set([
  "exe", "com", "bat", "cmd", "msi", "scr", "pif", "cpl", "jar",
  "sh", "bash", "zsh", "ps1", "psm1", "vbs", "vbe", "js", "mjs", "cjs",
  "jse", "wsf", "wsh", "hta", "reg", "dll", "so", "dylib", "app",
  "deb", "rpm", "apk", "bin", "run", "command", "py", "rb", "pl", "php",
])

const EXECUTABLE_TYPES = new Set([
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-executable",
  "application/x-sh",
  "application/x-shellscript",
  "application/x-bat",
  "application/vnd.microsoft.portable-executable",
  "application/java-archive",
])

/**
 * Strip everything but the file's own name.
 *
 * Browsers have historically sent full paths, and a crafted name can carry
 * `../`. Neither belongs in a stored key, so the last path segment is taken
 * and then reduced to characters that survive a URL.
 */
export function sanitizeAttachmentName(name: string): string {
  const base = name.replaceAll("\\", "/").split("/").at(-1) ?? ""
  const value = base
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120)
  return value || "tep-dinh-kem"
}

/** Every extension in the name, lowercased — `a.pdf.exe` yields both. */
function extensionsOf(name: string): string[] {
  return name.toLowerCase().split(".").slice(1)
}

/**
 * Decide whether a file may be attached.
 *
 * Executables are checked against BOTH the declared MIME type and every
 * extension in the name. A browser reports whatever the OS guesses and an
 * attacker sets it outright, so trusting the MIME alone lets `payload.exe`
 * through as a PDF; and checking only the final extension lets
 * `report.pdf.exe` past a reader who sees "pdf" in a list.
 */
export function inspectAttachment(file: {
  name: string
  size: number
  type: string
}): AttachmentDecision {
  if (file.size <= 0) return { ok: false, code: "NO_FILE" }
  if (file.size > MAX_BYTES) return { ok: false, code: "FILE_TOO_LARGE" }

  const contentType = file.type.trim().toLowerCase()
  const extensions = extensionsOf(file.name)

  // Executable check first: an executable is a refusal on its own terms, not
  // merely an unsupported type, and the message should say so.
  if (
    EXECUTABLE_TYPES.has(contentType) ||
    extensions.some((ext) => EXECUTABLE_EXTENSIONS.has(ext))
  ) {
    return { ok: false, code: "EXECUTABLE_REJECTED" }
  }

  if (!ALLOWED_TYPES.has(contentType)) {
    return { ok: false, code: "UNSUPPORTED_FILE_TYPE" }
  }

  return {
    ok: true,
    contentType,
    sanitizedName: sanitizeAttachmentName(file.name),
  }
}

export const ATTACHMENT_REJECTION_MESSAGES: Record<
  AttachmentRejection,
  string
> = {
  NO_FILE: "Chưa chọn tệp.",
  FILE_TOO_LARGE: "Tệp vượt quá 50MB.",
  EXECUTABLE_REJECTED: "Không cho phép tệp thực thi.",
  UNSUPPORTED_FILE_TYPE:
    "Chỉ nhận ảnh, PDF và tài liệu office (Word, Excel, PowerPoint).",
}
