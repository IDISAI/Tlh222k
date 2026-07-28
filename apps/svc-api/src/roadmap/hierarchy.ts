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
