// Ported from packages/core/src/roadmap (types.ts + utils/validate-hierarchy).
// Kept local so the service has no @workspace/core dependency.
import { RoadmapError } from "../common/roadmap-error"

export type NodeType = "role" | "skill" | "chapter" | "article"
export type ArticleType = "notion" | "jupyter"
export type NodeStatus = "locked" | "in_progress" | "done"

export const NODE_TYPES: readonly NodeType[] = [
  "role",
  "skill",
  "chapter",
  "article",
]

export const NODE_TYPE_LEVEL: Record<NodeType, number> = {
  role: 1,
  skill: 2,
  chapter: 3,
  article: 4,
}

export const MAX_CHILDREN = 100
export const MAX_TITLE_LENGTH = 150

/**
 * Parent→child validity. Base rule is level + 1. `article` is special: it may
 * attach under ANY level and may have `article` children (relaxed rule).
 */
export function validateHierarchy(
  parentType: NodeType,
  childType: NodeType
): boolean {
  if (childType === "article") return true
  return NODE_TYPE_LEVEL[childType] === NODE_TYPE_LEVEL[parentType] + 1
}

export function isNodeType(v: unknown): v is NodeType {
  return typeof v === "string" && (NODE_TYPES as readonly string[]).includes(v)
}

/**
 * Reject anything that isn't a plain http(s) URL. Blocks stored-XSS vectors
 * like `javascript:` / `data:` that would fire if the value is ever rendered
 * as a link href. Empty/undefined → null (field is optional).
 */
export function normalizeHttpUrl(raw: string | null | undefined): string | null {
  const v = raw?.trim()
  if (!v) return null
  let url: URL
  try {
    url = new URL(v)
  } catch {
    throw new RoadmapError("INVALID_URL")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new RoadmapError("INVALID_URL")
  }
  return url.toString()
}

/**
 * URL-safe slug (Vietnamese diacritics stripped), matching the core util.
 * Empty/special-only input falls back to "untitled" (notion-article-node
 * Req 9.1). Uniqueness is a deterministic `-{n}` suffix (Req 9.2) resolved by
 * the service, not here.
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
 * Whether content is shown, hidden, or merely unlisted — the same three states
 * for every kind of content. Mirrors `publish-status.ts` in the shared domain
 * package, duplicated here for the same reason `NodeType` and `slugify` are:
 * this service depends on the database package alone, not on the shared
 * package. Keep the two in step.
 *
 * Called `publishStatus` on each type because a block's `status` already means
 * the viewer's own progress through it.
 */
export const PUBLISH_STATUSES = ["DRAFT", "PUBLISHED", "PRIVATE"] as const

export type PublishStatus = (typeof PUBLISH_STATUSES)[number]
export type Visibility = "FREE" | "INTERNAL"

export function isPublishStatus(value: unknown): value is PublishStatus {
  return (
    typeof value === "string" &&
    (PUBLISH_STATUSES as readonly string[]).includes(value)
  )
}

/** Anything unreadable becomes DRAFT: fail closed, hide rather than expose. */
export function normalizePublishStatus(raw: unknown): PublishStatus {
  if (typeof raw !== "string") return "DRAFT"
  const value = raw.trim().toUpperCase()
  return isPublishStatus(value) ? value : "DRAFT"
}

export function normalizeVisibility(raw: unknown): Visibility {
  return typeof raw === "string" && raw.trim().toUpperCase() === "INTERNAL"
    ? "INTERNAL"
    : "FREE"
}

/**
 * The single visibility rule: Published is seen, Draft and Private are not.
 * A Private item is still reachable by a request that names it directly —
 * that is a different question from whether it is listed.
 */
export function reachesLearners(status: PublishStatus): boolean {
  return status === "PUBLISHED"
}

/**
 * Whether a direct link should render this block.
 *
 * The distinction `reachesLearners` documents but cannot express: PRIVATE
 * means unlisted, never unfinished, so a request that names an unlisted block
 * must serve it. Only a draft is closed. Mirrors `blockOpensByLink` in
 * @workspace/core — duplicated for the same reason PublishStatus is.
 */
export function blockOpensByLink(raw: unknown): boolean {
  return normalizePublishStatus(raw) !== "DRAFT"
}

/**
 * Whether this block belongs in a listing, a tab strip, or a search result.
 * Published AND discoverable — the strict half of the pair above.
 */
export function blockIsListed(raw: unknown): boolean {
  return normalizePublishStatus(raw) === "PUBLISHED"
}

/**
 * What a roadmap needs before its FIRST publish. Mirrors
 * `publish-eligibility.ts` in @workspace/core — duplicated for the same
 * reason PublishStatus is. Keep in step.
 *
 * Checked in a fixed order, one problem at a time: six at once reads as "this
 * is far off" when usually a single field is blank.
 */
export type PublishBlocker =
  | "TITLE_REQUIRED"
  | "SLUG_REQUIRED"
  | "DESCRIPTION_REQUIRED"
  | "FIELD_REQUIRED"
  | "COVER_REQUIRED"
  | "CONTENT_REQUIRED"
  | "DELETED_CONTENT_REFERENCED"

export type PublishEligibility =
  | { ok: true }
  | { ok: false; code: PublishBlocker }

export function roadmapPublishEligibility(candidate: {
  title: string | null | undefined
  slug: string | null | undefined
  description: string | null | undefined
  fieldCount: number
  coverUrl: string | null | undefined
  requiredNodeCount: number
  referencesDeletedContent: boolean
}): PublishEligibility {
  if (!candidate.title?.trim()) return { ok: false, code: "TITLE_REQUIRED" }
  if (!candidate.slug?.trim()) return { ok: false, code: "SLUG_REQUIRED" }
  if (!candidate.description?.trim()) {
    return { ok: false, code: "DESCRIPTION_REQUIRED" }
  }
  if (candidate.fieldCount < 1) return { ok: false, code: "FIELD_REQUIRED" }
  // https only: an http cover is a mixed-content block on a secure page (the
  // card renders with a hole and nothing reports it), and a javascript: one is
  // a script waiting to be clicked.
  if (!candidate.coverUrl?.trim().toLowerCase().startsWith("https://")) {
    return { ok: false, code: "COVER_REQUIRED" }
  }
  if (candidate.requiredNodeCount < 1) {
    return { ok: false, code: "CONTENT_REQUIRED" }
  }
  if (candidate.referencesDeletedContent) {
    return { ok: false, code: "DELETED_CONTENT_REFERENCED" }
  }
  return { ok: true }
}

export const PUBLISH_BLOCKER_MESSAGES: Record<PublishBlocker, string> = {
  TITLE_REQUIRED: "Cần có tiêu đề trước khi xuất bản.",
  SLUG_REQUIRED: "Cần có đường dẫn trước khi xuất bản.",
  DESCRIPTION_REQUIRED: "Cần có mô tả trước khi xuất bản.",
  FIELD_REQUIRED: "Roadmap phải thuộc ít nhất một lĩnh vực.",
  COVER_REQUIRED: "Cần ảnh bìa (đường dẫn https).",
  CONTENT_REQUIRED: "Roadmap phải có ít nhất một nội dung bắt buộc.",
  DELETED_CONTENT_REFERENCED:
    "Roadmap còn trỏ tới nội dung đã xoá. Gỡ nội dung đó khỏi canvas trước.",
}

/**
 * Attachment rules. Mirrors `attachment-policy.ts` in @workspace/core —
 * duplicated for the same reason PublishStatus is. Keep in step.
 *
 * The browser also checks these, but a browser check is a courtesy to the
 * person uploading, not a boundary: anything reaching this service must be
 * judged here too.
 */
export type AttachmentRejection =
  | "NO_FILE"
  | "FILE_TOO_LARGE"
  | "EXECUTABLE_REJECTED"
  | "UNSUPPORTED_FILE_TYPE"

export type AttachmentDecision =
  | { ok: true; contentType: string; sanitizedName: string }
  | { ok: false; code: AttachmentRejection }

const ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024

const ATTACHMENT_ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
])

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

export function sanitizeAttachmentName(name: string): string {
  const base = name.replaceAll("\\", "/").split("/").at(-1) ?? ""
  const value = base
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120)
  return value || "tep-dinh-kem"
}

export function inspectAttachment(file: {
  name: string
  size: number
  type: string
}): AttachmentDecision {
  if (file.size <= 0) return { ok: false, code: "NO_FILE" }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return { ok: false, code: "FILE_TOO_LARGE" }
  }

  const contentType = file.type.trim().toLowerCase()
  // EVERY extension, not just the last: "report.pdf.exe" runs as an executable
  // while reading as a PDF in a list.
  const extensions = file.name.toLowerCase().split(".").slice(1)

  if (
    EXECUTABLE_TYPES.has(contentType) ||
    extensions.some((ext) => EXECUTABLE_EXTENSIONS.has(ext))
  ) {
    return { ok: false, code: "EXECUTABLE_REJECTED" }
  }
  if (!ATTACHMENT_ALLOWED_TYPES.has(contentType)) {
    return { ok: false, code: "UNSUPPORTED_FILE_TYPE" }
  }
  return {
    ok: true,
    contentType,
    sanitizedName: sanitizeAttachmentName(file.name),
  }
}

export const ATTACHMENT_REJECTION_MESSAGES: Record<AttachmentRejection, string> = {
  NO_FILE: "Chưa chọn tệp.",
  FILE_TOO_LARGE: "Tệp vượt quá 50MB.",
  EXECUTABLE_REJECTED: "Không cho phép tệp thực thi.",
  UNSUPPORTED_FILE_TYPE:
    "Chỉ nhận ảnh, PDF và tài liệu office (Word, Excel, PowerPoint).",
}

export function publishStatusFromLegacy(isPublished: boolean): PublishStatus {
  return isPublished ? "PUBLISHED" : "DRAFT"
}

/** Lossy on purpose: PRIVATE collapses to false for the Document boundary. */
export function legacyIsPublished(status: PublishStatus): boolean {
  return status === "PUBLISHED"
}

/**
 * How demanding a roadmap block is. Mirrors `level.ts` in the shared domain
 * package — duplicated for the same reason PublishStatus is. Keep in step.
 */
export const LEVELS = ["BASIC", "INTERMEDIATE", "ADVANCED"] as const

export type Level = (typeof LEVELS)[number]

export function isLevel(value: unknown): value is Level {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value)
}

/** Null rather than a guess: "unjudged" is a real state for a block. */
export function normalizeLevel(raw: unknown): Level | null {
  if (typeof raw !== "string") return null
  const value = raw.trim().toUpperCase()
  return isLevel(value) ? value : null
}

/**
 * A Field's description is the subtitle over its full-viewport image, so it is
 * capped to what that scene holds. Mirrors `field-limits.ts` in the shared
 * package, duplicated for the same reason the other domain constants are.
 *
 * The form's maxLength only stops a person typing. An API caller is not
 * typing, so the cap has to hold here too.
 */
export const FIELD_DESCRIPTION_MAX = 160

export function normalizeFieldDescription(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim().slice(0, FIELD_DESCRIPTION_MAX)
  return trimmed || null
}
