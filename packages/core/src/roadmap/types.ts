export type NodeStatus = "locked" | "in_progress" | "done"

/**
 * 4-level node hierarchy (Req 2): role (1) → skill (2) → chapter (3) →
 * article (4). A child's level must equal its parent's level + 1.
 */
export type NodeType = "role" | "skill" | "chapter" | "article"

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

/** Article leaf nodes link out to one of these document kinds (Req 6). */
export type ArticleType = "notion" | "jupyter"

/** Max direct children per role/skill/chapter node (Req 2.5). */
export const MAX_CHILDREN = 100

/** Title is required and capped at 150 chars (Req 3.2 / 9.1). */
export const MAX_TITLE_LENGTH = 150

/** Description is optional and capped at 500 chars (Req 9.1). */
export const MAX_DESCRIPTION_LENGTH = 500

/**
 * Caller's role for service-level permission checks (Req 1.4/1.5). Mirrors
 * `UserRole` from `@workspace/core` navigation — kept as a local union so the
 * roadmap submodule stays self-contained.
 */
export type CallerRole = "viewer" | "admin" | "super-admin"

export interface Roadmap {
  id: string
  slug: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  isPublished: boolean
  nodeCount: number
}

export interface RoadmapNode {
  id: string
  roadmapId: string
  parentId: string | null
  title: string
  notionPageId: string | null
  positionX: number
  positionY: number
  order: number
  /** Personalized per viewer; "locked" for guests (Property 4). */
  status: NodeStatus
  /** Hierarchy level classification (Req 2.1). */
  nodeType: NodeType
  /** Routable identifier for role/skill detail pages (Req 6.1/6.2). */
  slug: string
  description: string | null
  /** Only meaningful for `article` nodes; null = document not linked yet. */
  articleType: ArticleType | null
  jupyterUrl: string | null
  /** True once permanently removed from the system → Disabled_Node (Req 4.4). */
  isDeleted?: boolean
}

export interface RoadmapGraph {
  roadmap: Roadmap
  nodes: RoadmapNode[]
}

export interface RoadmapProgress {
  roadmapId: string
  roadmapTitle: string
  doneCount: number
  totalCount: number
}

// ── Admin CRUD inputs (Req 1.4) ─────────────────────────────────────────────
// ponytail: these mirror the GraphQL inputs in graphql/schema.graphql.

export interface CreateRoadmapInput {
  slug: string
  title: string
  description?: string
  thumbnailUrl?: string
}

export interface CreateNodeInput {
  roadmapId: string
  parentId?: string | null
  title: string
  nodeType: NodeType
  /** Derived from `title` when omitted. */
  slug?: string
  description?: string
  notionPageId?: string
  articleType?: ArticleType
  jupyterUrl?: string
  positionX: number
  positionY: number
  order?: number
}

export type UpdateNodeInput = Partial<
  Omit<CreateNodeInput, "roadmapId" | "nodeType" | "slug">
>

// ── Service errors ──────────────────────────────────────────────────────────

export type RoadmapErrorCode =
  | "PERMISSION_DENIED"
  | "INVALID_NODE_TYPE"
  | "INVALID_HIERARCHY"
  | "LEAF_NODE_CANNOT_HAVE_CHILDREN"
  | "CHILDREN_LIMIT_EXCEEDED"
  | "NOT_FOUND"
  | "TIMEOUT"

/**
 * Typed service failure. `code` maps 1:1 onto the GraphQL error extension
 * codes so the toast layer can translate without string-matching messages.
 */
export class RoadmapServiceError extends Error {
  readonly code: RoadmapErrorCode

  constructor(code: RoadmapErrorCode, message?: string) {
    super(message ?? code)
    this.name = "RoadmapServiceError"
    this.code = code
  }
}

/** Narrow an unknown thrown value to a `RoadmapErrorCode` (default TIMEOUT-safe). */
export function roadmapErrorCode(error: unknown): RoadmapErrorCode | null {
  return error instanceof RoadmapServiceError ? error.code : null
}
