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
  // ── Metadata columns (roadmap-detail-columns spec) ────────────────────────
  /** ISO 8601 create time. Optional so legacy localStorage snapshots stay valid. */
  createdAt?: string
  /** ISO 8601 last-update time. Optional for legacy snapshots. */
  updatedAt?: string
  /** ID of the creator; used when the full `author` object is unavailable. */
  authorId?: string
  /** Embedded author (preferred over bare `authorId` when present). */
  author?: { id: string; name: string }
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
  /** Roadmap auto-created for role/skill nodes (notion-article-node Req 11). */
  linkedRoadmapId?: string | null
  /** Publish state synced with the linked Document (notion-article-node Req 7). */
  isPublished?: boolean
}

export interface RoadmapGraph {
  roadmap: Roadmap
  nodes: RoadmapNode[]
}

// ── Composition model (LEGO redesign, hf/roadmap) ───────────────────────────
// A role/skill/chapter node is an independent BLOCK. Each block owns a canvas —
// its "composition": which other blocks sit on it, where, and the edges between
// them. Membership REPLACES the parentId tree — a block can be a member of many
// compositions (reusable LEGO). `article` stays a leaf under its chapter, is
// never a block/member, and shows in the right sidebar of that chapter.

/** Node types that are canvas blocks (own a canvas + can be a member). */
export const BLOCK_TYPES: readonly NodeType[] = ["role", "skill", "chapter"]

/** Visual kind of a canvas edge — right-click a wire to change it or unlink. */
export type EdgeKind = "solid" | "dashed"

export const EDGE_KINDS: readonly EdgeKind[] = ["solid", "dashed"]

/** A directed link between two blocks on one owner's canvas. */
export interface RoadmapEdge {
  id: string
  sourceId: string
  targetId: string
  kind: EdgeKind
}

/** A block placed on an owner's canvas, with its position on THAT canvas. */
export interface CompositionMember {
  nodeId: string
  x: number
  y: number
}

/**
 * One owner block's canvas. The owner renders at the top and is NOT in
 * `members`; `members` are the other blocks dropped onto / created on it.
 * Absent from the store until the first edit — `getComposition` derives one
 * from the legacy parentId children so seed data appears without a migration.
 */
export interface Composition {
  ownerId: string
  members: CompositionMember[]
  edges: RoadmapEdge[]
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
  /** Creator id; the real backend stamps this from the auth context. */
  authorId?: string
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
> & {
  linkedRoadmapId?: string | null
  isPublished?: boolean
}

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
