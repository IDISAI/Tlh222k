import { Injectable, type OnModuleInit } from "@nestjs/common"
import type { Node as DbNode, Prisma } from "@prisma/client"

import { PrismaService } from "../prisma/prisma.service"
import { RoadmapEventsService } from "../sse/roadmap-events.service"
import { RoadmapError } from "../common/roadmap-error"
import { assertCanWrite, canAccessInternal, type CurrentUser } from "../auth/clerk"
import {
  MAX_TITLE_LENGTH,
  NODE_TYPES,
  blockIsListed,
  blockOpensByLink,
  isNodeType,
  legacyIsPublished,
  ATTACHMENT_REJECTION_MESSAGES,
  inspectAttachment,
  PUBLISH_BLOCKER_MESSAGES,
  roadmapPublishEligibility,
  normalizeHttpUrl,
  normalizeFieldDescription,
  normalizeLevel,
  normalizePublishStatus,
  publishStatusFromLegacy,
  reachesLearners,
  slugify,
  type ArticleType,
  type NodeStatus,
  type Level,
  type NodeType,
  type PublishStatus,
  type Visibility,
  normalizeVisibility,
} from "./hierarchy"
import { assertAcyclicTree } from "./tree-invariants"

const SAVE_TIMEOUT_MS = 10_000
const TREE_TRANSACTION_OPTIONS = {
  timeout: SAVE_TIMEOUT_MS,
  isolationLevel: "Serializable" as const,
}
/** Simple field writes (title, notionPageId, …) don't need Serializable. */
const FIELD_TRANSACTION_OPTIONS = {
  timeout: SAVE_TIMEOUT_MS,
}
const SERIALIZATION_RETRIES = 3

type TreeClient = Pick<Prisma.TransactionClient, "node">

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  )
}

/** Prisma P2034 / Postgres write-conflict under Serializable — safe to retry. */
function isSerializationFailure(error: unknown): boolean {
  if (hasPrismaCode(error, "P2034")) return true
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message
      : ""
  return (
    message.includes("write conflict") ||
    message.includes("could not serialize") ||
    message.includes("deadlock")
  )
}

async function withSerializationRetry<T>(
  run: () => Promise<T>,
  attempts = SERIALIZATION_RETRIES
): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await run()
    } catch (error) {
      lastError = error
      if (!isSerializationFailure(error) || i === attempts - 1) throw error
    }
  }
  throw lastError
}

export interface RoadmapDto {
  id: string
  slug: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  publishStatus: PublishStatus
  discoverability: "PUBLIC" | "PRIVATE"
  visibility: Visibility
  ownerId: string | null
  roleTags: string[]
  dueDate: string | null
  firstPublishedAt: string | null
  archivedAt: string | null
  nodeCount: number
  /** Distinct learners who have started content inside this roadmap. */
  learnerCount: number
  createdAt?: string | null
  updatedAt?: string | null
}

export interface NodeDto {
  id: string
  roadmapId: string
  parentId: string | null
  title: string
  slug: string
  description: string | null
  nodeType: NodeType
  notionPageId: string | null
  articleType: ArticleType | null
  jupyterUrl: string | null
  positionX: number
  positionY: number
  order: number
  status: NodeStatus
  isDeleted: boolean
  childrenCount: number
  linkedRoadmapId: string | null
  publishStatus: PublishStatus
  coverUrl: string | null
  level: Level | null
  visibility: Visibility
  tags: string[]
  /** Clerk id of whoever created this block. Stamped on create, never on update. */
  authorId: string | null
  /**
   * Discovery labels. Empty when the caller's query did not `include` them —
   * the GraphQL field is a non-null list, so callers see `[]`, never null.
   */
  fields: FieldDto[]
  /**
   * Distinct learners who started anything in this block's subtree. Only the
   * public block list fills it in; elsewhere it stays 0 rather than absent so
   * the GraphQL non-null contract holds.
   */
  learnerCount?: number
  /** Block creation time. Discovery sorts on it; it is not a publish time. */
  createdAt?: string | null
  /** Last edit time. */
  updatedAt?: string | null
  /** Ordered learner outcomes. Empty when the node declares none. */
  keyResults?: KeyResultDto[]
}

export interface LearnerRoadmapRef {
  ownerNodeId: string
  title: string
  completedAt?: string
}

export interface LearnerActivityDto {
  clerkUserId: string
  startedNodeCount: number
  completedNodeCount: number
  completedRoadmaps: LearnerRoadmapRef[]
  favoriteRoadmaps: LearnerRoadmapRef[]
  lastActiveAt: string | null
}

export interface AttachmentDto {
  id: string
  nodeId: string
  name: string
  url: string
  contentType: string
  sizeBytes: number
  createdAt: string
}

export interface KeyResultDto {
  id: string
  text: string
  position: number
}

export interface NotificationDto {
  id: string
  ownerNodeId: string
  roadmapTitle: string
  roadmapSlug: string
  publishedAt: string
  readAt: string | null
}

export interface FieldDto {
  id: string
  title: string
  slug: string
  order: number
  description: string | null
  imageUrl: string | null
  publishStatus: PublishStatus
}

/**
 * Every column of a discovery label, and the order the tab strip wants them in.
 * Both are named once because a label is selected from eight different queries:
 * inlined, the next column rename is eight chances to miss one.
 */
const FIELD_SELECT = {
  id: true,
  title: true,
  slug: true,
  order: true,
  description: true,
  imageUrl: true,
  publishStatus: true,
} as const
const FIELD_ORDER_BY: Prisma.FieldOrderByWithRelationInput[] = [
  { order: "asc" },
  { title: "asc" },
]

/**
 * Read a row's status. The column is a plain string, so it is narrowed here
 * rather than trusted — an unreadable value falls to DRAFT, same as an
 * unreadable role falls to viewer: a gate must never see an empty status.
 */
function statusOf(row: { publishStatus: string }) {
  return normalizePublishStatus(row.publishStatus)
}

/** A label as Postgres hands it back — `publishStatus` is a plain column. */
type DbField = {
  id: string
  title: string
  slug: string
  order: number
  description: string | null
  imageUrl: string | null
  publishStatus: string
}

/**
 * Narrow a stored label onto the DTO. The status is a plain string column, so
 * this is the boundary where an unreadable value becomes DRAFT rather than
 * leaking out as a status nothing downstream knows how to read.
 */
function toFieldDto(f: DbField): FieldDto {
  return {
    id: f.id,
    title: f.title,
    slug: f.slug,
    order: f.order,
    description: f.description,
    imageUrl: f.imageUrl,
    publishStatus: normalizePublishStatus(f.publishStatus),
  }
}

/** A `Node` row with its labels joined in. */
/**
 * A cap on Key Results. A node listing thirty outcomes is not describing what
 * a learner will be able to do, it is pasting a syllabus — and the detail
 * panel it renders in has no room for that.
 */
const MAX_KEY_RESULTS = 12

type DbNodeWithFields = DbNode & {
  fields?: DbField[]
  keyResults?: { id: string; text: string; position: number }[]
}

export interface GraphDto {
  roadmap: RoadmapDto
  nodes: NodeDto[]
}

export interface CreateRoadmapInput {
  slug: string
  title: string
  description?: string | null
  thumbnailUrl?: string | null
  discoverability?: "PUBLIC" | "PRIVATE" | null
  visibility?: Visibility | null
  roleTags?: string[] | null
  dueDate?: string | null
}

export interface UpdateRoadmapInput {
  title?: string | null
  description?: string | null
  thumbnailUrl?: string | null
  publishStatus?: PublishStatus | null
  discoverability?: "PUBLIC" | "PRIVATE" | null
  visibility?: Visibility | null
  roleTags?: string[] | null
  dueDate?: string | null
}

export interface CreateFieldInput {
  title: string
  slug?: string | null
  description?: string | null
  imageUrl?: string | null
  publishStatus?: PublishStatus | null
}

export interface UpdateFieldInput {
  title?: string | null
  slug?: string | null
  description?: string | null
  imageUrl?: string | null
  publishStatus?: PublishStatus | null
  order?: number | null
}

export interface CreateNodeInput {
  roadmapId: string
  parentId?: string | null
  title: string
  nodeType: NodeType
  slug?: string | null
  description?: string | null
  notionPageId?: string | null
  articleType?: ArticleType | null
  jupyterUrl?: string | null
  positionX: number
  positionY: number
  order?: number | null
  coverUrl?: string | null
  level?: string | null
  visibility?: Visibility | null
  tags?: string[] | null
  fieldIds?: string[] | null
}

export interface UpdateNodeInput {
  title?: string | null
  description?: string | null
  articleType?: ArticleType | null
  notionPageId?: string | null
  jupyterUrl?: string | null
  positionX?: number | null
  positionY?: number | null
  order?: number | null
  parentId?: string | null
  linkedRoadmapId?: string | null
  publishStatus?: PublishStatus | null
  coverUrl?: string | null
  level?: string | null
  visibility?: Visibility | null
  /** Replaces the whole tag list when present; `undefined` leaves it alone. */
  tags?: string[] | null
  /** Replaces the whole label set when present; `undefined` leaves it alone. */
  fieldIds?: string[] | null
}

export interface SaveNodeInput {
  id: string
  parentId?: string | null
  positionX: number
  positionY: number
}

export type CompositionScope = "DRAFT" | "PUBLISHED"
export type CompositionEdgeKind = "solid" | "dashed"

export interface CompositionMemberDto {
  nodeId: string
  x: number
  y: number
  isRequired: boolean
}

export interface CompositionEdgeDto {
  id: string
  sourceId: string
  targetId: string
  kind: CompositionEdgeKind
}

export interface CompositionDto {
  ownerId: string
  members: CompositionMemberDto[]
  edges: CompositionEdgeDto[]
}

export interface ReplaceCompositionMemberInput {
  nodeId: string
  x: number
  y: number
  isRequired?: boolean | null
}

export interface ReplaceCompositionEdgeInput {
  sourceId: string
  targetId: string
  kind: CompositionEdgeKind
}

@Injectable()
export class RoadmapService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: RoadmapEventsService
  ) {}

  async onModuleInit() {
    try {
      const allDocs = await this.prisma.document.findMany({
        select: { id: true, parentDocumentId: true, isPublished: true }
      })
      const docMap = new Map<string, { parentId: string | null; isPublished: boolean }>()
      for (const d of allDocs) {
        docMap.set(d.id, { parentId: d.parentDocumentId, isPublished: d.isPublished })
      }

      const toPublishIds = new Set<string>()
      for (const d of allDocs) {
        if (d.isPublished) {
          let curr = docMap.get(d.id)
          while (curr && curr.parentId) {
            const parent = docMap.get(curr.parentId)
            if (parent) {
              if (!parent.isPublished) {
                toPublishIds.add(curr.parentId)
              }
              curr = parent
            } else {
              break
            }
          }
        }
      }

      if (toPublishIds.size > 0) {
        await this.prisma.document.updateMany({
          where: { id: { in: Array.from(toPublishIds) } },
          data: { isPublished: true }
        })
      }

      const docs = await this.prisma.document.findMany({
        select: { id: true, slug: true, isPublished: true },
      })
      for (const doc of docs) {
        const linkedTo = {
          OR: [
            { notionPageId: doc.id },
            ...(doc.slug ? [{ slug: doc.slug }] : []),
          ],
        }
        // A Document only ever has two states, so it can assert "published" or
        // "not published" — never Private, which is a deliberate admin choice
        // orthogonal to the source document. Bringing the node down to Draft
        // whenever it merely isn't Published (the old boolean-shaped check)
        // would flip a Private node back to Draft the moment its document goes
        // unpublished, silently discarding that choice. So the sync is
        // one-directional per fact: published pulls a Draft/Private node up,
        // unpublished only pulls a Published node down — Private is never a
        // node this loop touches.
        if (doc.isPublished) {
          await this.prisma.node.updateMany({
            where: { ...linkedTo, publishStatus: { not: "PUBLISHED" } },
            data: { publishStatus: "PUBLISHED" },
          })
        } else {
          await this.prisma.node.updateMany({
            where: { ...linkedTo, publishStatus: "PUBLISHED" },
            data: { publishStatus: "DRAFT" },
          })
        }
      }
    } catch (err) {
      console.error("Failed to sync publish states on startup:", err)
    }
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  async roadmaps(
    includeUnpublished: boolean,
    user: CurrentUser | null
  ): Promise<RoadmapDto[]> {
    // includeUnpublished is honored only for admins; every other caller sees
    // published roadmaps regardless of the flag.
    const isAdmin = user?.role === "admin" || user?.role === "super-admin"
    const rows = await this.prisma.roadmap.findMany({
      where:
        includeUnpublished && isAdmin ? {} : { publishStatus: "PUBLISHED" },
      include: {
        _count: { select: { nodes: { where: { isDeleted: false } } } },
      },
      orderBy: { createdAt: "asc" },
    })
    const learners = await this.learnerCounts(rows.map((r) => r.id))
    return rows.map((r) =>
      this.toRoadmapDto(r, r._count.nodes, learners.get(r.id) ?? 0)
    )
  }

  async roadmapBySlug(slug: string): Promise<RoadmapDto | null> {
    const r = await this.prisma.roadmap.findUnique({
      where: { slug },
      include: {
        _count: { select: { nodes: { where: { isDeleted: false } } } },
      },
    })
    if (!r) return null
    const learners = await this.learnerCounts([r.id])
    return this.toRoadmapDto(r, r._count.nodes, learners.get(r.id) ?? 0)
  }

  /**
   * Unique learners per roadmap: people who have started content inside it.
   *
   * Counted as distinct `clerkUserId`, never as rows — one learner working
   * through twelve nodes is one learner. Page views are deliberately not part
   * of this: the access contract makes popularity mean "someone began", so a
   * roadmap cannot climb the sort by being opened and abandoned.
   *
   * One grouped query for the whole page rather than a count per card, because
   * the roadmap list renders every published roadmap at once.
   */
  /**
   * Replace a node's Key Results with an ordered list.
   *
   * Replace rather than patch: the editor works on the whole list — reordering
   * and deleting as much as adding — so sending the final state is simpler to
   * reason about than a diff, and cannot leave an orphaned row behind.
   * Position is the array index, so the order sent is the order read.
   */
  async setNodeKeyResults(
    nodeId: string,
    texts: string[],
    user: CurrentUser | null
  ): Promise<KeyResultDto[]> {
    assertCanWrite(user)
    const node = await this.prisma.node.findUnique({
      where: { id: nodeId },
      select: { id: true, isDeleted: true },
    })
    if (!node || node.isDeleted) throw new RoadmapError("NOT_FOUND")

    const cleaned = texts
      .map((text) => text.trim())
      .filter(Boolean)
      .slice(0, MAX_KEY_RESULTS)

    await this.prisma.$transaction(async (tx) => {
      await tx.nodeKeyResult.deleteMany({ where: { nodeId } })
      for (const [position, text] of cleaned.entries()) {
        await tx.nodeKeyResult.create({ data: { nodeId, text, position } })
      }
    })

    const rows = await this.prisma.nodeKeyResult.findMany({
      where: { nodeId },
      orderBy: { position: "asc" },
    })
    return rows.map((row) => ({
      id: row.id,
      text: row.text,
      position: row.position,
    }))
  }

  /**
   * A node's attachments, gated by the node's own entitlement.
   *
   * The attachment carries no access setting of its own: it inherits the
   * node's, so an INTERNAL node's files are INTERNAL without anyone having to
   * remember to say so twice. Refusing is deliberate rather than returning an
   * empty list — an empty list reads as "no attachments", which is a different
   * fact from "not for you".
   */
  async nodeAttachments(
    nodeId: string,
    user: CurrentUser | null
  ): Promise<AttachmentDto[]> {
    const node = await this.prisma.node.findUnique({
      where: { id: nodeId },
      select: { id: true, isDeleted: true, visibility: true },
    })
    if (!node || node.isDeleted) throw new RoadmapError("NOT_FOUND")
    if (
      normalizeVisibility(node.visibility) === "INTERNAL" &&
      !canAccessInternal(user)
    ) {
      throw new RoadmapError(
        "PERMISSION_DENIED",
        "Internal content requires AIO access"
      )
    }

    const rows = await this.prisma.nodeAttachment.findMany({
      where: { nodeId },
      orderBy: { createdAt: "asc" },
    })
    return rows.map((row) => ({
      id: row.id,
      nodeId: row.nodeId,
      name: row.name,
      url: row.url,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt.toISOString(),
    }))
  }

  /**
   * Record an uploaded attachment.
   *
   * The file itself is stored by the caller (Vercel Blob); this records where
   * it landed. The format rules run again here rather than trusting the client
   * that already checked them — a browser check is a courtesy to the person
   * uploading, not a boundary.
   */
  async addNodeAttachment(
    input: {
      nodeId: string
      name: string
      url: string
      contentType: string
      sizeBytes: number
    },
    user: CurrentUser | null
  ): Promise<AttachmentDto> {
    const actor = assertCanWrite(user)
    const node = await this.prisma.node.findUnique({
      where: { id: input.nodeId },
      select: { id: true, isDeleted: true },
    })
    if (!node || node.isDeleted) throw new RoadmapError("NOT_FOUND")

    const decision = inspectAttachment({
      name: input.name,
      size: input.sizeBytes,
      type: input.contentType,
    })
    if (!decision.ok) {
      throw new RoadmapError(
        "VALIDATION",
        ATTACHMENT_REJECTION_MESSAGES[decision.code]
      )
    }

    const row = await this.prisma.nodeAttachment.create({
      data: {
        nodeId: input.nodeId,
        name: decision.sanitizedName,
        url: input.url,
        contentType: decision.contentType,
        sizeBytes: input.sizeBytes,
        uploadedBy: actor.userId,
      },
    })
    return {
      id: row.id,
      nodeId: row.nodeId,
      name: row.name,
      url: row.url,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt.toISOString(),
    }
  }

  async deleteNodeAttachment(
    id: string,
    user: CurrentUser | null
  ): Promise<boolean> {
    assertCanWrite(user)
    const result = await this.prisma.nodeAttachment.deleteMany({ where: { id } })
    return result.count > 0
  }

  /**
   * One learner's activity, for the Admin/Super-admin learner profile.
   *
   * Identity stays with Clerk — this returns ids and counts, and the caller
   * joins the name, avatar and email from Clerk. Duplicating those here would
   * make this service a second, staler source of personal data.
   */
  async learnerActivity(
    clerkUserId: string,
    user: CurrentUser | null
  ): Promise<LearnerActivityDto> {
    assertCanWrite(user)

    const [progress, completions, favorites] = await Promise.all([
      this.prisma.userProgress.findMany({
        where: { clerkUserId, status: { in: ["in_progress", "done"] } },
        orderBy: { updatedAt: "desc" },
        select: {
          nodeId: true,
          status: true,
          updatedAt: true,
          node: { select: { title: true, roadmapId: true } },
        },
      }),
      this.prisma.userRoadmapCompletion.findMany({
        where: { clerkUserId },
        orderBy: { completedAt: "desc" },
        select: {
          ownerNodeId: true,
          completedAt: true,
          owner: { select: { title: true } },
        },
      }),
      this.prisma.userRoadmapFavorite.findMany({
        where: { clerkUserId },
        orderBy: { createdAt: "desc" },
        select: { ownerNodeId: true, owner: { select: { title: true } } },
      }),
    ])

    return {
      clerkUserId,
      startedNodeCount: progress.length,
      completedNodeCount: progress.filter((row) => row.status === "done").length,
      completedRoadmaps: completions.map((row) => ({
        ownerNodeId: row.ownerNodeId,
        title: row.owner.title,
        completedAt: row.completedAt.toISOString(),
      })),
      favoriteRoadmaps: favorites.map((row) => ({
        ownerNodeId: row.ownerNodeId,
        title: row.owner.title,
      })),
      // The most recent progress row IS the last activity: nothing else a
      // learner does writes a timestamp we could honestly call activity.
      lastActiveAt: progress[0]?.updatedAt.toISOString() ?? null,
    }
  }

  /** This caller's in-app notifications, newest first. Guests have none. */
  async myNotifications(
    user: CurrentUser | null
  ): Promise<NotificationDto[]> {
    if (!user) return []
    const rows = await this.prisma.roadmapNotification.findMany({
      where: { clerkUserId: user.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { owner: { select: { id: true, title: true, slug: true } } },
    })
    return rows.map((row) => ({
      id: row.id,
      ownerNodeId: row.ownerNodeId,
      roadmapTitle: row.owner.title,
      roadmapSlug: row.owner.slug,
      publishedAt: row.publishedAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
    }))
  }

  async markNotificationRead(
    id: string,
    user: CurrentUser | null
  ): Promise<boolean> {
    if (!user) throw new RoadmapError("PERMISSION_DENIED")
    // Scoped by owner in the same statement: without the clerkUserId in the
    // filter, anyone holding an id could mark someone else's card read.
    const result = await this.prisma.roadmapNotification.updateMany({
      where: { id, clerkUserId: user.userId, readAt: null },
      data: { readAt: new Date() },
    })
    return result.count > 0
  }

  /** Absent preference means email off — never treat a missing row as consent. */
  async myEmailOptIn(user: CurrentUser | null): Promise<boolean> {
    if (!user) return false
    const row = await this.prisma.notificationPreference.findUnique({
      where: { clerkUserId: user.userId },
      select: { emailOptedIn: true },
    })
    return row?.emailOptedIn ?? false
  }

  async setEmailOptIn(
    optedIn: boolean,
    user: CurrentUser | null
  ): Promise<boolean> {
    if (!user) throw new RoadmapError("PERMISSION_DENIED")
    await this.prisma.notificationPreference.upsert({
      where: { clerkUserId: user.userId },
      create: { clerkUserId: user.userId, emailOptedIn: optedIn },
      update: { emailOptedIn: optedIn },
    })
    return optedIn
  }

  /** Roadmaps this caller has favourited. Guests hold no list. */
  async myFavoriteRoadmapIds(user: CurrentUser | null): Promise<string[]> {
    if (!user) return []
    const rows = await this.prisma.userRoadmapFavorite.findMany({
      where: { clerkUserId: user.userId },
      orderBy: { createdAt: "desc" },
      select: { ownerNodeId: true },
    })
    return rows.map((row) => row.ownerNodeId)
  }

  /**
   * Toggle a favourite. Returns the resulting state so an optimistic UI can
   * reconcile against what was actually stored rather than assume.
   */
  async setRoadmapFavorite(
    ownerNodeId: string,
    favorite: boolean,
    user: CurrentUser | null
  ): Promise<boolean> {
    // Favouriting is account-backed by definition, so a guest gets a refusal
    // rather than a silent no-op — the UI needs to know to offer sign-in.
    if (!user) throw new RoadmapError("PERMISSION_DENIED")

    if (!favorite) {
      await this.prisma.userRoadmapFavorite.deleteMany({
        where: { clerkUserId: user.userId, ownerNodeId },
      })
      return false
    }

    const node = await this.prisma.node.findUnique({
      where: { id: ownerNodeId },
      select: { id: true, isDeleted: true },
    })
    if (!node || node.isDeleted) throw new RoadmapError("NOT_FOUND")

    await this.prisma.userRoadmapFavorite.upsert({
      where: {
        clerkUserId_ownerNodeId: { clerkUserId: user.userId, ownerNodeId },
      },
      create: { clerkUserId: user.userId, ownerNodeId },
      // Keep the original createdAt: re-favouriting something already
      // favourited should not reorder the learner's list.
      update: {},
    })
    return true
  }

  /**
   * Same rule as `learnerCounts`, but scoped to an explicit set of nodes —
   * used by the synthetic roadmap a single block is wrapped in, where the
   * block's subtree is the whole of "inside this roadmap".
   */
  private async learnersOfNodes(nodeIds: string[]): Promise<number> {
    if (nodeIds.length === 0) return 0
    const rows = await this.prisma.userProgress.findMany({
      where: {
        status: { in: ["in_progress", "done"] },
        nodeId: { in: nodeIds },
      },
      select: { clerkUserId: true },
      distinct: ["clerkUserId"],
    })
    return rows.length
  }

  private async learnerCounts(
    roadmapIds: string[]
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>()
    if (roadmapIds.length === 0) return counts

    const rows = await this.prisma.userProgress.findMany({
      where: {
        // "locked" is the resting state every node reports before anyone opens
        // it, so counting it would credit a roadmap with learners it never had.
        status: { in: ["in_progress", "done"] },
        node: { roadmapId: { in: roadmapIds }, isDeleted: false },
      },
      select: { clerkUserId: true, node: { select: { roadmapId: true } } },
    })

    const seen = new Map<string, Set<string>>()
    for (const row of rows) {
      const roadmapId = row.node.roadmapId
      const users = seen.get(roadmapId) ?? new Set<string>()
      users.add(row.clerkUserId)
      seen.set(roadmapId, users)
    }
    for (const [roadmapId, users] of seen) counts.set(roadmapId, users.size)
    return counts
  }

  /**
   * Graph by roadmap slug OR a role/skill node slug (subtree). Status is
   * personalized: guests get all-locked, else overlaid from UserProgress.
   */
  async roadmapGraph(
    slug: string,
    user: CurrentUser | null
  ): Promise<GraphDto | null> {
    const isAdmin = user?.role === "admin" || user?.role === "super-admin"
    const roadmap = await this.prisma.roadmap.findUnique({ where: { slug } })

    // Use the container Roadmap only when it is visible AND still has nodes. An
    // orphaned/unpublished record (e.g. a block spun out of the table then
    // dragged into another canvas, leaving an empty same-slug roadmap) must NOT
    // shadow the real block node — fall through to the node lookup below.
    if (roadmap && (reachesLearners(statusOf(roadmap)) || isAdmin)) {
      const nodes = await this.activeNodesOf(roadmap.id)
      if (nodes.length > 0) {
        return this.buildGraph(
          this.toRoadmapDto(roadmap, nodes.length),
          nodes,
          await this.progressMap(user, nodes)
        )
      }
    }

    // Node-slug navigation: role/skill/chapter slug → node + its subtree
    // (chapter → its article children). A block IS a roadmap (LEGO).
    const node = await this.prisma.node.findFirst({
      where: {
        slug,
        isDeleted: false,
        nodeType: { in: ["role", "skill", "chapter"] },
      },
    })
    if (!node) return null

    // The block (or its parent roadmap) must be published for non-admin viewers.
    if (!isAdmin) {
      const parentRoadmap = await this.prisma.roadmap.findUnique({
        where: { id: node.roadmapId },
      })
      // A block inherits its wrapper's reach: it is visible if either it or
      // the roadmap it is filed under is published.
      if (
        !reachesLearners(statusOf(node)) &&
        !(parentRoadmap && reachesLearners(statusOf(parentRoadmap)))
      ) {
        return null
      }
    }

    const subtree = await this.subtreeOf(node)
    const subtreeLearners = await this.learnersOfNodes(subtree.map((n) => n.id))
    const synthetic: RoadmapDto = {
      id: node.id,
      slug: node.slug,
      title: node.title,
      description: node.description,
      thumbnailUrl: null,
      // Synthetic wrapper around one block: it carries the block's own status
      // rather than a hardcoded one, so a private block cannot be dressed as
      // published by the shape used to render it.
      publishStatus: normalizePublishStatus(node.publishStatus),
      discoverability: "PUBLIC",
      visibility: normalizeVisibility(node.visibility),
      ownerId: node.authorId,
      roleTags: node.tags,
      dueDate: null,
      firstPublishedAt: null,
      archivedAt: null,
      nodeCount: subtree.length,
      learnerCount: subtreeLearners,
    }
    return this.buildGraph(
      synthetic,
      subtree,
      await this.progressMap(user, subtree)
    )
  }

  /** Builder graph by id. Deleted nodes never render — no ghost nodes. */
  async roadmapGraphById(
    id: string,
    user: CurrentUser | null
  ): Promise<GraphDto | null> {
    assertCanWrite(user)
    const roadmap = await this.prisma.roadmap.findUnique({
      where: { id },
      include: {
        _count: { select: { nodes: { where: { isDeleted: false } } } },
      },
    })
    if (!roadmap) return null
    const nodes = await this.prisma.node.findMany({
      where: { roadmapId: id, isDeleted: false },
      orderBy: { order: "asc" },
      include: { keyResults: { orderBy: { position: "asc" } } },
    })
    return this.buildGraph(
      this.toRoadmapDto(roadmap, roadmap._count.nodes),
      nodes,
      {}
    )
  }

  /** Every node in the system for the sidebar (Req 3.6, incl. deleted). */
  async allNodes(user: CurrentUser | null): Promise<NodeDto[]> {
    // Exposes soft-deleted + unpublished content: admins only.
    assertCanWrite(user)
    // Labels ride along: the admin detail panel renders a node's labels, and
    // without them here the picker opens empty on a node that already has some.
    const nodes = await this.prisma.node.findMany({
      orderBy: { order: "asc" },
      include: {
        fields: {
          orderBy: FIELD_ORDER_BY,
          select: FIELD_SELECT,
        },
      },
    })
    return this.attachComputed(nodes, {})
  }

  /**
   * PUBLIC LEGO inventory: every published role/skill block. A block IS a
   * roadmap (LEGO — independent + reusable), so the web home lists all of them,
   * not just top-level ones. No auth; only published, non-deleted blocks leak.
   * childrenCount is the direct-child count across the whole tree (card "N chủ đề").
   */
  async publicBlocks(fieldIds?: string[] | null, _user: CurrentUser | null = null): Promise<NodeDto[]> {
    // Every non-deleted node is fetched even when filtering, because
    // childrenCount counts children across the WHOLE tree — narrowing the
    // query by label would undercount a block whose children carry no labels.
    const all = await this.prisma.node.findMany({
      where: { isDeleted: false },
      orderBy: { order: "asc" },
      include: {
        fields: {
          orderBy: FIELD_ORDER_BY,
          select: FIELD_SELECT,
        },
      },
    })
    const childCount = new Map<string, number>()
    for (const n of all) {
      if (n.parentId) {
        childCount.set(n.parentId, (childCount.get(n.parentId) ?? 0) + 1)
      }
    }

    // Learners per block, rolled up its subtree: someone working a chapter deep
    // inside a role has started that role. Counted as distinct people, so one
    // learner across five of its nodes stays one. Done in memory over the rows
    // already fetched above rather than a query per card — this list renders
    // every published block at once.
    const started = await this.prisma.userProgress.findMany({
      where: { status: { in: ["in_progress", "done"] }, node: { isDeleted: false } },
      select: { clerkUserId: true, nodeId: true },
    })
    const parentOf = new Map(all.map((n) => [n.id, n.parentId]))
    const learnersByBlock = new Map<string, Set<string>>()
    for (const row of started) {
      // Walk to the root, marking every ancestor. `seen` guards the walk against
      // a parentId cycle, which would otherwise hang the request.
      const seen = new Set<string>()
      let current: string | null | undefined = row.nodeId
      while (current && !seen.has(current)) {
        seen.add(current)
        const users = learnersByBlock.get(current) ?? new Set<string>()
        users.add(row.clerkUserId)
        learnersByBlock.set(current, users)
        current = parentOf.get(current)
      }
    }
    // OR across labels: the strip selects one tab at a time, and a block
    // carrying both AI and Data must show up under either.
    const wanted = fieldIds?.length ? new Set(fieldIds) : null
    const fieldPosition = wanted
      ? new Map(
          (
            await this.prisma.fieldMembership.findMany({
              where: { fieldId: { in: [...wanted] } },
              select: { nodeId: true, position: true },
              orderBy: { position: "asc" },
            })
          ).map((membership) => [membership.nodeId, membership.position])
        )
      : new Map<string, number>()

    return all
      .filter(
        (n) =>
          // Listing gate: published AND discoverable. An unlisted block still
          // opens by direct link (see publicBlockGraph) but must never appear
          // in a grid, a tab strip, or a search result.
          blockIsListed(n.publishStatus) &&
          (n.nodeType === "role" || n.nodeType === "skill")
      )
      .filter((n) => !wanted || n.fields.some((f) => wanted.has(f.id)))
      .sort(
        (left, right) =>
          (fieldPosition.get(left.id) ?? left.order) -
            (fieldPosition.get(right.id) ?? right.order) ||
          left.order - right.order
      )
      .map((n) => ({
        ...this.toNodeDto(n, "locked", childCount.get(n.id) ?? 0),
        learnerCount: learnersByBlock.get(n.id)?.size ?? 0,
      }))
  }

  /**
   * PUBLIC per-block composition (viewer ⇄ builder sync). Returns ONE block
   * (by node id) plus its DIRECT children — the same single-level canvas the
   * admin builder shows: block blocks render on the canvas, article children
   * feed the detail panel. Drilling into a member fetches ITS block graph.
   * No auth; the block (or its container roadmap) must be published.
   */
  async publicBlockGraph(id: string, user: CurrentUser | null): Promise<GraphDto | null> {
    const node = await this.prisma.node.findUnique({ where: { id } })
    if (!node || node.isDeleted || node.nodeType === "article") return null
    if (normalizeVisibility(node.visibility) === "INTERNAL" && !canAccessInternal(user)) {
      throw new RoadmapError("PERMISSION_DENIED", "Internal block requires AIO access")
    }
    // Direct-link gate. Deliberately NOT `reachesLearners`, which answers
    // "published" and so refused an unlisted block — the one case a direct
    // link exists to serve. Only a draft 404s here; discoverability decides
    // listings, not whether a named block opens.
    if (!blockOpensByLink(node.publishStatus)) {
      const parent = await this.prisma.roadmap.findUnique({
        where: { id: node.roadmapId },
      })
      if (!parent || !blockOpensByLink(parent.publishStatus)) return null
    }
    // Return the WHOLE roadmap's nodes so the web viewer derives the exact same
    // composition (deriveCompositionFromNodes) the admin builder renders — one
    // shared derive keeps viewer ⇄ builder in sync.
    const roadmapNodes = await this.prisma.node.findMany({
      where: { roadmapId: node.roadmapId, isDeleted: false },
      orderBy: { order: "asc" },
      include: { keyResults: { orderBy: { position: "asc" } } },
    })
    const visibleNodes = canAccessInternal(user)
      ? roadmapNodes
      : roadmapNodes.filter((item) => normalizeVisibility(item.visibility) !== "INTERNAL")
    const visibleLearners = await this.learnersOfNodes(
      visibleNodes.map((item) => item.id)
    )
    const synthetic: RoadmapDto = {
      id: node.id,
      slug: node.slug,
      title: node.title,
      description: node.description,
      thumbnailUrl: null,
      // Synthetic wrapper around one block: it carries the block's own status
      // rather than a hardcoded one, so a private block cannot be dressed as
      // published by the shape used to render it.
      publishStatus: normalizePublishStatus(node.publishStatus),
      discoverability: "PUBLIC",
      visibility: normalizeVisibility(node.visibility),
      ownerId: node.authorId,
      roleTags: node.tags,
      dueDate: null,
      firstPublishedAt: null,
      archivedAt: null,
      nodeCount: visibleNodes.length,
      learnerCount: visibleLearners,
    }
    return this.buildGraph(synthetic, visibleNodes, {})
  }

  async myProgress(user: CurrentUser | null): Promise<
    {
      roadmapId: string
      roadmapTitle: string
      doneCount: number
      totalCount: number
    }[]
  > {
    if (!user) return []
    const progress = await this.prisma.userProgress.findMany({
      where: { clerkUserId: user.userId },
    })
    if (progress.length === 0) return []
    const statusByNode = new Map(progress.map((p) => [p.nodeId, p.status]))

    const roadmaps = await this.prisma.roadmap.findMany({
      include: { nodes: { where: { isDeleted: false } } },
    })
    const result: {
      roadmapId: string
      roadmapTitle: string
      doneCount: number
      totalCount: number
    }[] = []
    for (const r of roadmaps) {
      const statuses = r.nodes.map((n) => statusByNode.get(n.id) ?? "locked")
      if (!statuses.some((s) => s !== "locked")) continue
      result.push({
        roadmapId: r.id,
        roadmapTitle: r.title,
        doneCount: statuses.filter((s) => s === "done").length,
        totalCount: r.nodes.length,
      })
    }
    return result
  }

  // ── Mutations ────────────────────────────────────────────────────────────────

  async createRoadmap(
    input: CreateRoadmapInput,
    user: CurrentUser | null
  ): Promise<RoadmapDto> {
    const actor = assertCanWrite(user)
    const slug = await this.uniqueRoadmapSlug(
      input.slug?.trim() || slugify(input.title)
    )
    const created = await this.prisma.roadmap.create({
      data: {
        slug,
        title: input.title.trim().slice(0, MAX_TITLE_LENGTH),
        description: input.description?.trim() || null,
        thumbnailUrl: input.thumbnailUrl ?? null,
        publishStatus: "DRAFT",
        discoverability: input.discoverability ?? "PUBLIC",
        visibility: input.visibility ?? "FREE",
        ownerId: actor.userId,
        roleTags: input.roleTags ?? [],
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
      },
    })
    await this.events.emit(created.id)
    return this.toRoadmapDto(created, 0)
  }

  async updateRoadmap(
    id: string,
    input: UpdateRoadmapInput,
    user: CurrentUser | null
  ): Promise<RoadmapDto> {
    assertCanWrite(user)
    const existing = await this.prisma.roadmap.findUnique({ where: { id } })
    if (!existing) throw new RoadmapError("NOT_FOUND")
    const updated = await this.prisma.roadmap.update({
      where: { id },
      data: {
        title:
          input.title !== undefined && input.title !== null
            ? input.title.trim().slice(0, MAX_TITLE_LENGTH)
            : undefined,
        description:
          input.description !== undefined
            ? input.description?.trim() || null
            : undefined,
        thumbnailUrl:
          input.thumbnailUrl !== undefined
            ? input.thumbnailUrl || null
            : undefined,
        publishStatus:
          input.publishStatus !== undefined && input.publishStatus !== null
            ? input.publishStatus
            : undefined,
        discoverability: input.discoverability ?? undefined,
        visibility: input.visibility ?? undefined,
        roleTags: input.roleTags ?? undefined,
        dueDate:
          input.dueDate !== undefined
            ? input.dueDate
              ? new Date(input.dueDate)
              : null
            : undefined,
        firstPublishedAt:
          input.publishStatus === "PUBLISHED" && !existing.firstPublishedAt
            ? new Date()
            : undefined,
      },
      include: {
        _count: { select: { nodes: { where: { isDeleted: false } } } },
      },
    })
    await this.events.emit(id)
    return this.toRoadmapDto(updated, updated._count.nodes)
  }

  async deleteRoadmap(id: string, user: CurrentUser | null): Promise<boolean> {
    assertCanWrite(user)
    const existing = await this.prisma.roadmap.findUnique({ where: { id } })
    if (!existing) throw new RoadmapError("NOT_FOUND")
    await this.prisma.roadmap.delete({ where: { id } }) // cascade deletes nodes
    await this.events.emit(id)
    return true
  }

  async createNode(
    input: CreateNodeInput,
    user: CurrentUser | null
  ): Promise<NodeDto> {
    assertCanWrite(user)
    if (!isNodeType(input.nodeType)) {
      throw new RoadmapError("INVALID_NODE_TYPE")
    }

    const title = input.title.trim().slice(0, MAX_TITLE_LENGTH)
    const slug = await this.uniqueNodeSlug(input.slug?.trim() || slugify(title))
    const created = await withSerializationRetry(() =>
      this.prisma.$transaction(async (tx) => {
        await this.validateParent(tx, input.parentId ?? null, input.roadmapId)
        const order =
          input.order ??
          (await tx.node.count({ where: { roadmapId: input.roadmapId } }))

        return tx.node.create({
          data: {
            roadmapId: input.roadmapId,
            parentId: input.parentId ?? null,
            title,
            slug,
            nodeType: input.nodeType,
            description: input.description?.trim() || null,
            notionPageId: input.notionPageId ?? null,
            articleType: input.articleType ?? null,
            jupyterUrl: normalizeHttpUrl(input.jupyterUrl),
            fields: input.fieldIds?.length
              ? { connect: input.fieldIds.map((fid) => ({ id: fid })) }
              : undefined,
            fieldMemberships: input.fieldIds?.length
              ? {
                  create: [...new Set(input.fieldIds)].map((fieldId, position) => ({
                    fieldId,
                    position,
                  })),
                }
              : undefined,
            positionX: input.positionX,
            positionY: input.positionY,
            order,
            coverUrl: normalizeHttpUrl(input.coverUrl),
            tags: input.tags ? [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))] : undefined,
            level: normalizeLevel(input.level),
            visibility: normalizeVisibility(input.visibility),
            // "Người phụ trách" is the creator, not a chosen assignee — stamped
            // from the auth context, never a client-supplied input, same rule
            // Document.authorId already follows.
            authorId: user?.userId ?? null,
          },
          // Echo the labels back so the admin picker renders them straight
          // after create instead of blanking.
          include: {
            fields: {
              orderBy: FIELD_ORDER_BY,
              select: FIELD_SELECT,
            },
          },
        })
      }, TREE_TRANSACTION_OPTIONS)
    )
    await this.events.emit(input.roadmapId)
    return this.toNodeDto(created, "locked", 0)
  }

  async updateNode(
    id: string,
    input: UpdateNodeInput,
    user: CurrentUser | null
  ): Promise<NodeDto> {
    assertCanWrite(user)
    // Tree reparent needs Serializable + cycle check. Field-only updates
    // (notionPageId link after create, title, …) use ReadCommitted so concurrent
    // create→link races don't fail with write-conflict / deadlock.
    const needsTreeGuard = input.parentId !== undefined

    const updated = await withSerializationRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const node = await tx.node.findUnique({ where: { id } })
          if (!node || node.isDeleted) throw new RoadmapError("NOT_FOUND")

          if (needsTreeGuard && input.parentId !== node.parentId) {
            const parentId = input.parentId ?? null
            await this.validateParent(tx, parentId, node.roadmapId, id)
            const forest = await tx.node.findMany({
              where: { roadmapId: node.roadmapId, isDeleted: false },
              select: { id: true, parentId: true },
            })
            assertAcyclicTree(
              forest.map((candidate) =>
                candidate.id === id ? { ...candidate, parentId } : candidate
              )
            )
          }

          const u = await tx.node.update({
            where: { id },
            data: {
              parentId:
                input.parentId !== undefined
                  ? (input.parentId ?? null)
                  : undefined,
              title:
                input.title !== undefined && input.title !== null
                  ? input.title.trim().slice(0, MAX_TITLE_LENGTH)
                  : undefined,
              description:
                input.description !== undefined
                  ? input.description?.trim() || null
                  : undefined,
              articleType:
                input.articleType !== undefined
                  ? (input.articleType ?? null)
                  : undefined,
              notionPageId:
                input.notionPageId !== undefined
                  ? input.notionPageId?.trim() || null
                  : undefined,
              jupyterUrl:
                input.jupyterUrl !== undefined
                  ? normalizeHttpUrl(input.jupyterUrl)
                  : undefined,
              positionX: input.positionX ?? undefined,
              positionY: input.positionY ?? undefined,
              order: input.order ?? undefined,
              linkedRoadmapId:
                input.linkedRoadmapId !== undefined
                  ? (input.linkedRoadmapId ?? null)
                  : undefined,
              publishStatus:
                input.publishStatus !== undefined && input.publishStatus !== null
                  ? input.publishStatus
                  : undefined,
              coverUrl:
                input.coverUrl !== undefined
                  ? normalizeHttpUrl(input.coverUrl)
                  : undefined,
              tags:
                input.tags !== undefined && input.tags !== null
                  ? [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))]
                  : undefined,
              // An explicit null clears the level; omitting it leaves it alone.
              level:
                input.level !== undefined ? normalizeLevel(input.level) : undefined,
              visibility:
                input.visibility !== undefined ? normalizeVisibility(input.visibility) : undefined,
              // `set` replaces the whole label list, so unchecking a label in
              // the picker actually removes it. Omitted (undefined) input
              // leaves existing labels untouched.
              fields:
                input.fieldIds !== undefined && input.fieldIds !== null
                  ? { set: input.fieldIds.map((fid) => ({ id: fid })) }
                  : undefined,
            },
            // Without this the mutation echoes back an empty label list and the
            // admin picker blanks itself immediately after a successful save.
            include: {
              fields: {
                orderBy: FIELD_ORDER_BY,
                select: FIELD_SELECT,
              },
            },
          })

          // Keep old implicit relation alive while every reader moves to the
          // explicit join table. The join holds per-Field order, which the
          // implicit relation cannot represent.
          if (input.fieldIds !== undefined && input.fieldIds !== null) {
            const nextFieldIds = [...new Set(input.fieldIds)]
            const existingMemberships = await tx.fieldMembership.findMany({
              where: { nodeId: id },
              select: { fieldId: true },
            })
            const previousIds = new Set(
              existingMemberships.map((membership) => membership.fieldId)
            )
            const nextIds = new Set(nextFieldIds)
            const removedIds = [...previousIds].filter((fieldId) => !nextIds.has(fieldId))
            if (removedIds.length) {
              await tx.fieldMembership.deleteMany({
                where: { nodeId: id, fieldId: { in: removedIds } },
              })
            }
            for (const fieldId of nextFieldIds) {
              if (previousIds.has(fieldId)) continue
              const latest = await tx.fieldMembership.aggregate({
                where: { fieldId },
                _max: { position: true },
              })
              await tx.fieldMembership.create({
                data: { fieldId, nodeId: id, position: (latest._max.position ?? -1) + 1 },
              })
            }
          }

          // Title sync, plus publish state for callers that still set it from
          // node edit (the block-level Xuất bản/Hủy xuất bản toggle) even
          // though the Document editor is the primary place for it. Documents
          // keep only a boolean, so PRIVATE collapses to false here — a
          // deliberate, lossy translation, not an oversight.
          if (node.notionPageId) {
            const docData: { title?: string; isPublished?: boolean } = {}
            if (input.title != null) docData.title = u.title
            if (input.publishStatus != null)
              docData.isPublished = legacyIsPublished(input.publishStatus)
            if (Object.keys(docData).length > 0) {
              await tx.document.updateMany({
                where: { id: node.notionPageId },
                data: docData,
              })
            }
          }
          return u
        },
        needsTreeGuard ? TREE_TRANSACTION_OPTIONS : FIELD_TRANSACTION_OPTIONS
      )
    )
    await this.events.emit(updated.roadmapId)
    const childrenCount = await this.childrenCount(id)
    return this.toNodeDto(updated, "locked", childrenCount)
  }

  /**
   * Permanent delete of a SINGLE node. Direct children survive: they reparent
   * up to the deleted node's parent so a sub-roadmap is never lost when its
   * parent roadmap is deleted.
   */
  async deleteNode(id: string, user: CurrentUser | null): Promise<boolean> {
    assertCanWrite(user)
    const node = await this.prisma.node.findUnique({ where: { id } })
    if (!node) throw new RoadmapError("NOT_FOUND")

    await this.prisma.$transaction(async (tx) => {
      // Children reparent up to this node's parent (null → become roots).
      await tx.node.updateMany({
        where: { parentId: id },
        data: { parentId: node.parentId ?? null },
      })
      // Archive only this node's own linked Document, in the same transaction.
      if (node.notionPageId) {
        await tx.document.updateMany({
          where: { id: node.notionPageId },
          data: { isArchived: true },
        })
      }
      await tx.node.update({ where: { id }, data: { isDeleted: true } })
    })
    await this.events.emit(node.roadmapId)
    return true
  }

  /**
   * Bring an archived block back.
   *
   * Deletion here is a soft delete, which the contract calls archiving — but
   * an archive nobody can reverse is a delete with extra steps. Restoring
   * returns it as a DRAFT rather than to whatever status it had: it has been
   * off the public side, possibly for a long time, and an editor should look
   * at it before learners do.
   */
  async restoreNode(id: string, user: CurrentUser | null): Promise<boolean> {
    assertCanWrite(user)
    const node = await this.prisma.node.findUnique({ where: { id } })
    if (!node) throw new RoadmapError("NOT_FOUND")
    if (!node.isDeleted) return false

    await this.prisma.$transaction(async (tx) => {
      if (node.notionPageId) {
        await tx.document.updateMany({
          where: { id: node.notionPageId },
          data: { isArchived: false },
        })
      }
      await tx.node.update({
        where: { id },
        data: { isDeleted: false, publishStatus: "DRAFT" },
      })
    })
    await this.events.emit(node.roadmapId)
    return true
  }

  /** Archived blocks, so the CMS can offer them back. */
  async archivedNodes(user: CurrentUser | null): Promise<NodeDto[]> {
    assertCanWrite(user)
    const rows = await this.prisma.node.findMany({
      where: { isDeleted: true },
      orderBy: { updatedAt: "desc" },
      include: { fields: { orderBy: FIELD_ORDER_BY, select: FIELD_SELECT } },
    })
    return rows.map((n) => this.toNodeDto(n, "locked", 0))
  }

  /**
   * Move a node into another roadmap (sidebar drag-drop). No clone: the node
   * keeps its identity, slug and linked resources — it just changes owner.
   * Children left behind in the source roadmap are detached so no edge ever
   * crosses roadmaps.
   */
  async moveNode(
    nodeId: string,
    roadmapId: string,
    positionX: number,
    positionY: number,
    user: CurrentUser | null
  ): Promise<NodeDto> {
    assertCanWrite(user)
    let sourceRoadmapId = ""
    const moved = await this.prisma.$transaction(async (tx) => {
      const node = await tx.node.findUnique({ where: { id: nodeId } })
      if (!node || node.isDeleted) throw new RoadmapError("NOT_FOUND")
      const target = await tx.roadmap.findUnique({ where: { id: roadmapId } })
      if (!target) throw new RoadmapError("NOT_FOUND")
      sourceRoadmapId = node.roadmapId

      await tx.node.updateMany({
        where: { parentId: nodeId },
        data: { parentId: null },
      })
      const order = await tx.node.count({ where: { roadmapId } })
      return tx.node.update({
        where: { id: nodeId },
        data: { roadmapId, parentId: null, positionX, positionY, order },
      })
    }, TREE_TRANSACTION_OPTIONS)
    await this.events.emit(sourceRoadmapId)
    if (sourceRoadmapId !== roadmapId) await this.events.emit(roadmapId)
    return this.toNodeDto(moved, "locked", 0)
  }

  /** Batch replace the roadmap's active nodes (positions + parent links). */
  async saveRoadmap(
    roadmapId: string,
    nodes: SaveNodeInput[],
    user: CurrentUser | null
  ): Promise<boolean> {
    assertCanWrite(user)
    try {
      await this.prisma.$transaction(async (tx) => {
        const roadmap = await tx.roadmap.findUnique({
          where: { id: roadmapId },
        })
        if (!roadmap) throw new RoadmapError("NOT_FOUND")

        const existing = await tx.node.findMany({
          where: { roadmapId },
          select: { id: true, parentId: true, isDeleted: true },
        })
        const byId = new Map(existing.map((node) => [node.id, node]))
        const proposed = new Map<string, string | null>()
        for (const node of nodes) {
          if (!byId.has(node.id) || proposed.has(node.id)) {
            throw new RoadmapError("INVALID_HIERARCHY", "INVALID_TREE")
          }
          proposed.set(node.id, node.parentId ?? null)
        }

        const finalForest = existing
          .filter((node) => !node.isDeleted || proposed.has(node.id))
          .map((node) => ({
            id: node.id,
            parentId: proposed.get(node.id) ?? node.parentId,
          }))
        assertAcyclicTree(finalForest)

        for (const node of nodes) {
          await tx.node.update({
            where: { id: node.id },
            data: {
              parentId: node.parentId ?? null,
              positionX: node.positionX,
              positionY: node.positionY,
              isDeleted: false,
            },
          })
        }
      }, TREE_TRANSACTION_OPTIONS)
    } catch (error) {
      if (hasPrismaCode(error, "P2028")) throw new RoadmapError("TIMEOUT")
      throw error
    }
    await this.events.emit(roadmapId) // ≤500ms after the write (Req 8.3)
    return true
  }

  async composition(
    ownerId: string,
    scope: CompositionScope,
    user: CurrentUser | null
  ): Promise<CompositionDto> {
    if (scope === "DRAFT") assertCanWrite(user)
    const owner = await this.prisma.node.findFirst({
      where: { id: ownerId, isDeleted: false },
      select: { id: true },
    })
    if (!owner) throw new RoadmapError("NOT_FOUND")

    const [members, edges] = await Promise.all([
      this.prisma.compositionMembership.findMany({
        where: { ownerId, scope },
        orderBy: [{ createdAt: "asc" }, { nodeId: "asc" }],
      }),
      this.prisma.compositionEdge.findMany({
        where: { ownerId, scope },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    ])

    return {
      ownerId,
      members: members.map((member) => ({
        nodeId: member.nodeId,
        x: member.positionX,
        y: member.positionY,
        isRequired: member.isRequired,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        kind: edge.kind === "dashed" ? "dashed" : "solid",
      })),
    }
  }

  async addCompositionMember(
    ownerId: string,
    nodeId: string,
    positionX: number,
    positionY: number,
    isRequired: boolean,
    user: CurrentUser | null
  ): Promise<CompositionDto> {
    assertCanWrite(user)
    if (ownerId === nodeId) {
      throw new RoadmapError("INVALID_HIERARCHY", "OWNER_IS_NOT_A_MEMBER")
    }
    const count = await this.prisma.node.count({
      where: { id: { in: [ownerId, nodeId] }, isDeleted: false },
    })
    if (count !== 2) throw new RoadmapError("NOT_FOUND")

    await this.prisma.compositionMembership.upsert({
      where: {
        ownerId_nodeId_scope: { ownerId, nodeId, scope: "DRAFT" },
      },
      create: {
        ownerId,
        nodeId,
        scope: "DRAFT",
        positionX,
        positionY,
        isRequired,
      },
      update: { positionX, positionY, isRequired },
    })
    return this.composition(ownerId, "DRAFT", user)
  }

  async moveCompositionMember(
    ownerId: string,
    nodeId: string,
    positionX: number,
    positionY: number,
    user: CurrentUser | null
  ): Promise<boolean> {
    assertCanWrite(user)
    const result = await this.prisma.compositionMembership.updateMany({
      where: { ownerId, nodeId, scope: "DRAFT" },
      data: { positionX, positionY },
    })
    if (result.count === 0) throw new RoadmapError("NOT_FOUND")
    return true
  }

  async removeCompositionMember(
    ownerId: string,
    nodeId: string,
    user: CurrentUser | null
  ): Promise<CompositionDto> {
    assertCanWrite(user)
    await this.prisma.$transaction([
      this.prisma.compositionEdge.deleteMany({
        where: {
          ownerId,
          scope: "DRAFT",
          OR: [{ sourceId: nodeId }, { targetId: nodeId }],
        },
      }),
      this.prisma.compositionMembership.deleteMany({
        where: { ownerId, nodeId, scope: "DRAFT" },
      }),
    ])
    return this.composition(ownerId, "DRAFT", user)
  }

  async addCompositionEdge(
    ownerId: string,
    sourceId: string,
    targetId: string,
    kind: CompositionEdgeKind,
    user: CurrentUser | null
  ): Promise<CompositionEdgeDto> {
    assertCanWrite(user)
    if (sourceId === targetId) {
      throw new RoadmapError("INVALID_HIERARCHY", "SELF_EDGE")
    }
    const memberIds = [sourceId, targetId].filter((id) => id !== ownerId)
    const memberCount = await this.prisma.compositionMembership.count({
      where: { ownerId, scope: "DRAFT", nodeId: { in: memberIds } },
    })
    if (memberCount !== new Set(memberIds).size) {
      throw new RoadmapError("INVALID_HIERARCHY", "EDGE_OUTSIDE_COMPOSITION")
    }
    const edge = await this.prisma.compositionEdge.upsert({
      where: {
        ownerId_sourceId_targetId_scope: {
          ownerId,
          sourceId,
          targetId,
          scope: "DRAFT",
        },
      },
      create: { ownerId, sourceId, targetId, scope: "DRAFT", kind },
      update: { kind },
    })
    return {
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      kind: edge.kind === "dashed" ? "dashed" : "solid",
    }
  }

  async updateCompositionEdgeKind(
    ownerId: string,
    edgeId: string,
    kind: CompositionEdgeKind,
    user: CurrentUser | null
  ): Promise<CompositionEdgeDto> {
    assertCanWrite(user)
    const existing = await this.prisma.compositionEdge.findFirst({
      where: { id: edgeId, ownerId, scope: "DRAFT" },
    })
    if (!existing) throw new RoadmapError("NOT_FOUND")
    const edge = await this.prisma.compositionEdge.update({
      where: { id: edgeId },
      data: { kind },
    })
    return {
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      kind: edge.kind === "dashed" ? "dashed" : "solid",
    }
  }

  async removeCompositionEdge(
    ownerId: string,
    edgeId: string,
    user: CurrentUser | null
  ): Promise<CompositionDto> {
    assertCanWrite(user)
    await this.prisma.compositionEdge.deleteMany({
      where: { id: edgeId, ownerId, scope: "DRAFT" },
    })
    return this.composition(ownerId, "DRAFT", user)
  }

  async replaceComposition(
    ownerId: string,
    members: ReplaceCompositionMemberInput[],
    edges: ReplaceCompositionEdgeInput[],
    user: CurrentUser | null
  ): Promise<CompositionDto> {
    assertCanWrite(user)
    const memberIds = [...new Set(members.map((member) => member.nodeId))]
    if (memberIds.length !== members.length || memberIds.includes(ownerId)) {
      throw new RoadmapError("INVALID_HIERARCHY", "INVALID_MEMBERS")
    }
    const existingCount = await this.prisma.node.count({
      where: { id: { in: [ownerId, ...memberIds] }, isDeleted: false },
    })
    if (existingCount !== memberIds.length + 1) {
      throw new RoadmapError("NOT_FOUND")
    }
    const allowed = new Set([ownerId, ...memberIds])
    if (
      edges.some(
        (edge) =>
          edge.sourceId === edge.targetId ||
          !allowed.has(edge.sourceId) ||
          !allowed.has(edge.targetId)
      )
    ) {
      throw new RoadmapError("INVALID_HIERARCHY", "INVALID_EDGES")
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.compositionEdge.deleteMany({
        where: { ownerId, scope: "DRAFT" },
      })
      await tx.compositionMembership.deleteMany({
        where: { ownerId, scope: "DRAFT" },
      })
      for (const member of members) {
        await tx.compositionMembership.create({
          data: {
            ownerId,
            nodeId: member.nodeId,
            scope: "DRAFT",
            positionX: member.x,
            positionY: member.y,
            isRequired: member.isRequired ?? true,
          },
        })
      }
      for (const edge of edges) {
        await tx.compositionEdge.create({
          data: { ownerId, scope: "DRAFT", ...edge },
        })
      }
    })
    return this.composition(ownerId, "DRAFT", user)
  }

  async publishComposition(
    ownerId: string,
    user: CurrentUser | null
  ): Promise<CompositionDto> {
    assertCanWrite(user)
    await this.assertPublishable(ownerId)
    // One instant shared by every notification this publish creates, so the
    // unique key can recognise a retry.
    const publishedAt = new Date()
    await this.prisma.$transaction(async (tx) => {
      const [members, edges] = await Promise.all([
        tx.compositionMembership.findMany({
          where: { ownerId, scope: "DRAFT" },
        }),
        tx.compositionEdge.findMany({
          where: { ownerId, scope: "DRAFT" },
        }),
      ])
      await tx.compositionEdge.deleteMany({
        where: { ownerId, scope: "PUBLISHED" },
      })
      await tx.compositionMembership.deleteMany({
        where: { ownerId, scope: "PUBLISHED" },
      })
      for (const member of members) {
        await tx.compositionMembership.create({
          data: {
            ownerId,
            nodeId: member.nodeId,
            scope: "PUBLISHED",
            positionX: member.positionX,
            positionY: member.positionY,
            isRequired: member.isRequired,
          },
        })
      }
      for (const edge of edges) {
        await tx.compositionEdge.create({
          data: {
            ownerId,
            sourceId: edge.sourceId,
            targetId: edge.targetId,
            scope: "PUBLISHED",
            kind: edge.kind,
          },
        })
      }
      // Inside the same transaction as the composition copy. The contract asks
      // for ONE atomic publish covering metadata, content, composition and
      // positions — flipping the status afterwards would leave a window where
      // the roadmap is public but still showing its previous layout.
      await tx.node.update({
        where: { id: ownerId },
        data: { publishStatus: "PUBLISHED" },
      })
      await tx.roadmap.updateMany({
        // First publish only: the date a roadmap first reached learners does
        // not move when it is later edited and republished.
        where: { id: ownerId, firstPublishedAt: null },
        data: { firstPublishedAt: new Date() },
      })
      await this.notifyFollowers(tx, ownerId, publishedAt)
    })
    return this.composition(ownerId, "PUBLISHED", user)
  }

  /**
   * Tell the people who follow this roadmap that it changed.
   *
   * Audience is exactly who the contract names: learners who started content
   * inside it, plus learners who favourited it. Both, deduplicated — someone
   * who did both is one person and gets one card.
   *
   * `publishedAt` is the same instant for every recipient, which together with
   * the unique key makes the write idempotent: a retried or double-submitted
   * publish cannot stack a second card on someone who has not read the first.
   * Draft edits reach none of this — nothing here runs until publish.
   */
  private async notifyFollowers(
    tx: Prisma.TransactionClient,
    ownerNodeId: string,
    publishedAt: Date
  ): Promise<void> {
    const members = await tx.compositionMembership.findMany({
      where: { ownerId: ownerNodeId, scope: "PUBLISHED" },
      select: { nodeId: true },
    })
    const nodeIds = [ownerNodeId, ...members.map((m) => m.nodeId)]

    const [started, favorited] = await Promise.all([
      tx.userProgress.findMany({
        where: { nodeId: { in: nodeIds }, status: { in: ["in_progress", "done"] } },
        select: { clerkUserId: true },
        distinct: ["clerkUserId"],
      }),
      tx.userRoadmapFavorite.findMany({
        where: { ownerNodeId },
        select: { clerkUserId: true },
      }),
    ])

    const audience = new Set([
      ...started.map((row) => row.clerkUserId),
      ...favorited.map((row) => row.clerkUserId),
    ])
    if (audience.size === 0) return

    await tx.roadmapNotification.createMany({
      data: [...audience].map((clerkUserId) => ({
        clerkUserId,
        ownerNodeId,
        publishedAt,
      })),
      skipDuplicates: true,
    })
  }

  /**
   * Refuse a publish that would put an unfinished roadmap in front of
   * learners. Reads the DRAFT composition, because that is what is about to
   * become public.
   */
  private async assertPublishable(ownerId: string): Promise<void> {
    const owner = await this.prisma.node.findUnique({
      where: { id: ownerId },
      include: { fields: { select: { id: true } } },
    })
    if (!owner || owner.isDeleted) throw new RoadmapError("NOT_FOUND")

    // The contract gates the FIRST publish. A roadmap already facing learners
    // is re-published every time an editor saves a layout change, and blocking
    // that on a rule it predates would strand existing content — the editor
    // could no longer save, with no way to satisfy a check about its debut.
    if (normalizePublishStatus(owner.publishStatus) !== "DRAFT") return

    const draftMembers = await this.prisma.compositionMembership.findMany({
      where: { ownerId, scope: "DRAFT" },
      select: { nodeId: true, isRequired: true },
    })
    const memberNodes = await this.prisma.node.findMany({
      where: { id: { in: draftMembers.map((m) => m.nodeId) } },
      select: { id: true, isDeleted: true },
    })
    const deleted = new Set(
      memberNodes.filter((n) => n.isDeleted).map((n) => n.id)
    )
    // A member row whose node row is gone entirely counts as deleted too —
    // publishing it would put a door on the canvas that opens onto nothing.
    const known = new Set(memberNodes.map((n) => n.id))
    const referencesDeletedContent = draftMembers.some(
      (m) => deleted.has(m.nodeId) || !known.has(m.nodeId)
    )

    const verdict = roadmapPublishEligibility({
      title: owner.title,
      slug: owner.slug,
      description: owner.description,
      fieldCount: owner.fields.length,
      coverUrl: owner.coverUrl,
      requiredNodeCount: draftMembers.filter(
        (m) => m.isRequired && !deleted.has(m.nodeId) && known.has(m.nodeId)
      ).length,
      referencesDeletedContent,
    })
    if (!verdict.ok) {
      throw new RoadmapError("VALIDATION", PUBLISH_BLOCKER_MESSAGES[verdict.code])
    }
  }

  /**
   * Throw the working draft away and start again from what is public.
   *
   * The inverse of publish: it copies PUBLISHED back over DRAFT rather than
   * emptying it, so discarding lands the editor on the live layout instead of
   * a blank canvas.
   */
  async discardCompositionDraft(
    ownerId: string,
    user: CurrentUser | null
  ): Promise<CompositionDto> {
    assertCanWrite(user)
    await this.prisma.$transaction(async (tx) => {
      const [members, edges] = await Promise.all([
        tx.compositionMembership.findMany({
          where: { ownerId, scope: "PUBLISHED" },
        }),
        tx.compositionEdge.findMany({ where: { ownerId, scope: "PUBLISHED" } }),
      ])
      await tx.compositionEdge.deleteMany({ where: { ownerId, scope: "DRAFT" } })
      await tx.compositionMembership.deleteMany({
        where: { ownerId, scope: "DRAFT" },
      })
      for (const member of members) {
        await tx.compositionMembership.create({
          data: {
            ownerId,
            nodeId: member.nodeId,
            scope: "DRAFT",
            positionX: member.positionX,
            positionY: member.positionY,
            isRequired: member.isRequired,
          },
        })
      }
      for (const edge of edges) {
        await tx.compositionEdge.create({
          data: {
            ownerId,
            sourceId: edge.sourceId,
            targetId: edge.targetId,
            scope: "DRAFT",
            kind: edge.kind,
          },
        })
      }
    })
    return this.composition(ownerId, "DRAFT", user)
  }

  async setNodeStatus(
    nodeId: string,
    status: NodeStatus,
    user: CurrentUser | null
  ): Promise<boolean> {
    if (!user) throw new RoadmapError("PERMISSION_DENIED")
    await this.prisma.userProgress.upsert({
      where: { clerkUserId_nodeId: { clerkUserId: user.userId, nodeId } },
      create: { clerkUserId: user.userId, nodeId, status },
      update: { status },
    })
    if (status === "done") await this.stampFinishedRoadmaps(user.userId, nodeId)
    return true
  }

  /**
   * First open starts a node. Completion is never implied by opening — the
   * contract requires an explicit learner action for that — so this only ever
   * moves a node forward out of the untouched state, and leaves `in_progress`
   * and `done` exactly where they are. Guests are a no-op rather than an
   * error: they may read content, they simply have nowhere to record it.
   */
  async markNodeOpened(
    nodeId: string,
    user: CurrentUser | null
  ): Promise<boolean> {
    if (!user) return false
    const existing = await this.prisma.userProgress.findUnique({
      where: { clerkUserId_nodeId: { clerkUserId: user.userId, nodeId } },
      select: { status: true },
    })
    if (existing && existing.status !== "locked") return false
    await this.prisma.userProgress.upsert({
      where: { clerkUserId_nodeId: { clerkUserId: user.userId, nodeId } },
      create: { clerkUserId: user.userId, nodeId, status: "in_progress" },
      update: { status: "in_progress" },
    })
    return true
  }

  /**
   * Record any roadmap this node's completion just finished.
   *
   * Written at the moment it happens rather than derived on read, because a
   * derived answer changes when the roadmap does: an editor adding a required
   * node would un-complete everyone who had finished, which the access
   * contract forbids. Only the canvases this node actually sits on are
   * examined — the same node can be required on one and optional on another.
   */
  private async stampFinishedRoadmaps(
    clerkUserId: string,
    nodeId: string
  ): Promise<void> {
    const owners = await this.prisma.compositionMembership.findMany({
      where: { nodeId, scope: "PUBLISHED", isRequired: true },
      select: { ownerId: true },
    })
    if (owners.length === 0) return

    for (const { ownerId } of owners) {
      const required = await this.prisma.compositionMembership.findMany({
        where: { ownerId, scope: "PUBLISHED", isRequired: true },
        select: { nodeId: true },
      })
      // Nothing to finish is not the same as finished.
      if (required.length === 0) continue

      const doneCount = await this.prisma.userProgress.count({
        where: {
          clerkUserId,
          status: "done",
          nodeId: { in: required.map((member) => member.nodeId) },
        },
      })
      if (doneCount < required.length) continue

      await this.prisma.userRoadmapCompletion.upsert({
        where: {
          clerkUserId_ownerNodeId: { clerkUserId, ownerNodeId: ownerId },
        },
        create: { clerkUserId, ownerNodeId: ownerId },
        // Keep the original timestamp: the learner finished it when they
        // finished it, and re-marking a node does not move that date.
        update: {},
      })
    }
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  private toRoadmapDto(
    r: {
      id: string
      slug: string
      title: string
      description: string | null
      thumbnailUrl: string | null
      publishStatus: string
      discoverability: string
      visibility: string
      ownerId: string | null
      roleTags: string[]
      dueDate: Date | null
      firstPublishedAt: Date | null
      archivedAt: Date | null
      createdAt?: Date
      updatedAt?: Date
    },
    nodeCount: number,
    learnerCount = 0
  ): RoadmapDto {
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description,
      thumbnailUrl: r.thumbnailUrl,
      publishStatus: normalizePublishStatus(r.publishStatus),
      discoverability: r.discoverability === "PRIVATE" ? "PRIVATE" : "PUBLIC",
      visibility: normalizeVisibility(r.visibility),
      ownerId: r.ownerId,
      roleTags: r.roleTags,
      dueDate: r.dueDate?.toISOString() ?? null,
      firstPublishedAt: r.firstPublishedAt?.toISOString() ?? null,
      archivedAt: r.archivedAt?.toISOString() ?? null,
      nodeCount,
      learnerCount,
      createdAt: r.createdAt ? r.createdAt.toISOString() : null,
      updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
    }
  }

  private toNodeDto(
    n: DbNodeWithFields,
    status: NodeStatus,
    childrenCount: number
  ): NodeDto {
    return {
      id: n.id,
      roadmapId: n.roadmapId,
      parentId: n.parentId,
      title: n.title,
      slug: n.slug,
      description: n.description,
      nodeType: n.nodeType as NodeType,
      notionPageId: n.notionPageId,
      articleType: (n.articleType as ArticleType | null) ?? null,
      jupyterUrl: n.jupyterUrl,
      positionX: n.positionX,
      positionY: n.positionY,
      order: n.order,
      status,
      isDeleted: n.isDeleted,
      childrenCount,
      linkedRoadmapId: n.linkedRoadmapId,
      publishStatus: normalizePublishStatus(n.publishStatus),
      coverUrl: n.coverUrl ?? null,
      tags: n.tags ?? [],
      authorId: n.authorId ?? null,
      // Narrowed here rather than trusted: the column is a plain string, and an
      // unreadable value means "unjudged", not a level nothing can render.
      level: normalizeLevel(n.level),
      visibility: normalizeVisibility(n.visibility),
      fields: (n.fields ?? []).map(toFieldDto),
      // Only `publicBlocks` rolls up real learner numbers; every other caller
      // reports 0 so the non-null GraphQL field always has a value.
      learnerCount: 0,
      createdAt: n.createdAt ? n.createdAt.toISOString() : null,
      updatedAt: n.updatedAt ? n.updatedAt.toISOString() : null,
      // Only queries that `include` them fill this in; the GraphQL field is a
      // non-null list, so every other caller sees [] rather than null.
      keyResults: (n.keyResults ?? []).map((kr) => ({
        id: kr.id,
        text: kr.text,
        position: kr.position,
      })),
    }
  }

  // ── Discovery labels (Field) ───────────────────────────────────────────────

  /** Every label, for the public tab strip. No auth — labels are not secret. */
  async listFields(includeUnpublished = false): Promise<FieldDto[]> {
    const rows = await this.prisma.field.findMany({
      where: includeUnpublished ? {} : { publishStatus: "PUBLISHED" },
      orderBy: FIELD_ORDER_BY,
      select: FIELD_SELECT,
    })
    return rows.map(toFieldDto)
  }

  /** Drafts never escape the CMS; Private is deliberately direct-link only. */
  async fieldBySlug(slug: string): Promise<FieldDto | null> {
    const row = await this.prisma.field.findUnique({
      where: { slug },
      select: FIELD_SELECT,
    })
    if (!row || row.publishStatus === "DRAFT") return null
    return toFieldDto(row)
  }

  /**
   * Find-or-create by title. The admin picker offers "create" inline, so two
   * admins typing "AI" and "ai" must land on ONE label — otherwise the tab
   * strip slowly fills with near-duplicates nobody can merge.
   */
  async createField(
    user: CurrentUser | null,
    input: CreateFieldInput
  ): Promise<FieldDto> {
    assertCanWrite(user)
    const trimmed = input.title.trim()
    if (!trimmed) throw new RoadmapError("VALIDATION", "Field title is required")
    if (input.publishStatus === "PUBLISHED" || input.publishStatus === "PRIVATE") {
      throw new RoadmapError("VALIDATION", "Create the Field as Draft, then add its public block before publishing")
    }

    const existing = await this.prisma.field.findFirst({
      where: { title: { equals: trimmed, mode: "insensitive" } },
      select: FIELD_SELECT,
    })
    if (existing) return toFieldDto(existing)

    const count = await this.prisma.field.count()
    const created = await this.prisma.field.create({
      data: {
        title: trimmed,
        slug: input.slug?.trim() || (await this.uniqueFieldSlug(trimmed)),
        order: count,
        description: normalizeFieldDescription(input.description),
        imageUrl: input.imageUrl?.trim() || null,
        publishStatus: input.publishStatus ?? "DRAFT",
      },
      select: FIELD_SELECT,
    })
    return toFieldDto(created)
  }

  /**
   * Rename in place. This is the whole reason labels are a table rather than a
   * string column on `Node`: one row changes and every block carrying the label
   * follows, with no bulk update and no chance of a half-renamed set.
   */
  async updateField(
    user: CurrentUser | null,
    id: string,
    input: UpdateFieldInput
  ): Promise<FieldDto> {
    assertCanWrite(user)
    const existing = await this.prisma.field.findUnique({
      where: { id },
      select: FIELD_SELECT,
    })
    if (!existing) throw new RoadmapError("NOT_FOUND", "Field not found")
    const trimmed = input.title?.trim()
    if (input.title !== undefined && !trimmed) {
      throw new RoadmapError("VALIDATION", "Field title is required")
    }

    // Retitling onto another label's title would break the unique index with a
    // raw Prisma error; reject it as a domain failure instead.
    const clash = trimmed ? await this.prisma.field.findFirst({
      where: {
        title: { equals: trimmed, mode: "insensitive" },
        id: { not: id },
      },
      select: { id: true },
    }) : null
    if (clash) {
      throw new RoadmapError("VALIDATION", `Lĩnh vực "${trimmed}" đã tồn tại`)
    }

    // Validate at write boundary. UI validation is not an access-control rule.
    if (input.publishStatus === "PUBLISHED" || input.publishStatus === "PRIVATE") {
      const description = input.description === undefined
        ? existing.description
        : normalizeFieldDescription(input.description)
      const imageUrl = input.imageUrl === undefined
        ? existing.imageUrl
        : input.imageUrl?.trim() || null
      const publicBlockCount = await this.prisma.node.count({
        where: {
          isDeleted: false,
          nodeType: { in: ["role", "skill"] },
          publishStatus: "PUBLISHED",
          fields: { some: { id } },
        },
      })
      if (!description) {
        throw new RoadmapError("VALIDATION", "Field needs a description before it can be published")
      }
      if (!imageUrl?.startsWith("https://")) {
        throw new RoadmapError("VALIDATION", "Field needs an HTTPS image before it can be published")
      }
      if (publicBlockCount === 0) {
        throw new RoadmapError("VALIDATION", "Field needs one published roadmap block before it can be published")
      }
    }

    const updated = await this.prisma.field.update({
      where: { id },
      // Deliberately never writes slug: a saved Field's slug is a promise to
      // everyone who has already linked to it, so retitling never moves it.
      // `input.slug` is only honoured by createField, before the Field exists.
      data: {
        ...(trimmed ? { title: trimmed } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl?.trim() || null } : {}),
        ...(input.publishStatus != null ? { publishStatus: input.publishStatus } : {}),
        ...(input.order != null ? { order: input.order } : {}),
      },
      select: FIELD_SELECT,
    })
    return toFieldDto(updated)
  }

  /** Drops the label; the join rows go with it, the blocks themselves stay. */
  async deleteField(user: CurrentUser | null, id: string): Promise<boolean> {
    assertCanWrite(user)
    const field = await this.prisma.field.findUnique({
      where: { id },
      select: { publishStatus: true },
    })
    if (!field) throw new RoadmapError("NOT_FOUND", "Field not found")
    if (normalizePublishStatus(field.publishStatus) !== "DRAFT") {
      throw new RoadmapError("VALIDATION", "Only draft Fields can be deleted; take this Field back to Draft first")
    }
    // A Field must be empty before it goes. The delete does not touch the
    // roadmaps themselves — FieldMembership cascades, the blocks survive — but
    // it would quietly pull them out of the grouping readers browse by, and
    // nothing downstream would report that. Make the admin move them first.
    const memberCount = await this.prisma.fieldMembership.count({
      where: { fieldId: id },
    })
    if (memberCount > 0) {
      throw new RoadmapError(
        "VALIDATION",
        "This Field still holds roadmaps; move them to another Field before deleting it"
      )
    }
    await this.prisma.field.delete({ where: { id } })
    return true
  }

  /** Ordered node ids for a single Field Workspace. CMS-only. */
  async fieldNodeIds(fieldId: string, user: CurrentUser | null): Promise<string[]> {
    assertCanWrite(user)
    const memberships = await this.prisma.fieldMembership.findMany({
      where: { fieldId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { nodeId: true },
    })
    return memberships.map((membership) => membership.nodeId)
  }

  /** Reorder memberships without changing a block's membership in other Fields. */
  async reorderFieldMembership(
    fieldId: string,
    nodeIds: string[],
    user: CurrentUser | null
  ): Promise<boolean> {
    assertCanWrite(user)
    const uniqueIds = [...new Set(nodeIds)]
    const memberships = await this.prisma.fieldMembership.findMany({
      where: { fieldId },
      select: { nodeId: true },
    })
    if (
      uniqueIds.length !== nodeIds.length ||
      uniqueIds.length !== memberships.length ||
      memberships.some((membership) => !uniqueIds.includes(membership.nodeId))
    ) {
      throw new RoadmapError("VALIDATION", "Membership order does not match this Field")
    }
    await this.prisma.$transaction(
      uniqueIds.map((nodeId, position) =>
        this.prisma.fieldMembership.update({
          where: { fieldId_nodeId: { fieldId, nodeId } },
          data: { position },
        })
      )
    )
    return true
  }

  /**
   * `excludeId` is the label being renamed: without it a rename that keeps the
   * same slug would collide with the row's own slug and get suffixed "-2".
   */
  private async uniqueFieldSlug(
    title: string,
    excludeId?: string
  ): Promise<string> {
    const base =
      title
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "field"
    let slug = base
    for (
      let i = 2;
      await this.prisma.field.findFirst({
        where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { id: true },
      });
      i++
    ) {
      slug = `${base}-${i}`
    }
    return slug
  }

  private attachComputed(
    nodes: DbNodeWithFields[],
    progress: Record<string, NodeStatus>
  ): NodeDto[] {
    const childCount = new Map<string, number>()
    for (const n of nodes) {
      if (n.parentId && !n.isDeleted) {
        childCount.set(n.parentId, (childCount.get(n.parentId) ?? 0) + 1)
      }
    }
    return nodes.map((n) =>
      this.toNodeDto(n, progress[n.id] ?? "locked", childCount.get(n.id) ?? 0)
    )
  }

  private buildGraph(
    roadmap: RoadmapDto,
    nodes: DbNode[],
    progress: Record<string, NodeStatus>
  ): GraphDto {
    return { roadmap, nodes: this.attachComputed(nodes, progress) }
  }

  private async activeNodesOf(roadmapId: string): Promise<DbNode[]> {
    return this.prisma.node.findMany({
      where: { roadmapId, isDeleted: false },
      orderBy: { order: "asc" },
      // Key Results ride along with the graph: the detail panel opens from a
      // node already in hand, so fetching them separately would show an empty
      // outcomes list for a frame on every open.
      include: { keyResults: { orderBy: { position: "asc" } } },
    })
  }

  private async subtreeOf(root: DbNode): Promise<DbNode[]> {
    const all = await this.prisma.node.findMany({
      where: { roadmapId: root.roadmapId, isDeleted: false },
      orderBy: { order: "asc" },
      include: { keyResults: { orderBy: { position: "asc" } } },
    })
    const byParent = new Map<string, DbNode[]>()
    for (const n of all) {
      if (!n.parentId) continue
      const list = byParent.get(n.parentId) ?? []
      list.push(n)
      byParent.set(n.parentId, list)
    }
    const result: DbNode[] = [root]
    const queue = [root.id]
    const visited = new Set<string>(queue)
    while (queue.length) {
      const id = queue.shift() as string
      for (const child of byParent.get(id) ?? []) {
        if (visited.has(child.id)) continue
        visited.add(child.id)
        result.push(child)
        queue.push(child.id)
      }
    }
    return result
  }

  private async childrenCount(nodeId: string): Promise<number> {
    return this.prisma.node.count({
      where: { parentId: nodeId, isDeleted: false },
    })
  }

  private async progressMap(
    user: CurrentUser | null,
    nodes: DbNode[]
  ): Promise<Record<string, NodeStatus>> {
    if (!user || nodes.length === 0) return {}
    const rows = await this.prisma.userProgress.findMany({
      where: {
        clerkUserId: user.userId,
        nodeId: { in: nodes.map((n) => n.id) },
      },
    })
    const map: Record<string, NodeStatus> = {}
    for (const r of rows) map[r.nodeId] = r.status as NodeStatus
    return map
  }

  /**
   * Parent existence check only. Node types may link freely now — any node can
   * be a child of any node, with no hierarchy rule and no children cap (the
   * former `validateHierarchy` / `MAX_CHILDREN` gates were removed on request).
   * We still confirm the parent exists so we never write a dangling link.
   */
  private async validateParent(
    client: TreeClient,
    parentId: string | null,
    roadmapId: string,
    _selfId?: string
  ): Promise<void> {
    if (!parentId) return
    const parent = await client.node.findFirst({
      where: { id: parentId },
      select: { id: true, roadmapId: true, isDeleted: true },
    })
    if (!parent || parent.isDeleted || parent.roadmapId !== roadmapId) {
      throw new RoadmapError("INVALID_HIERARCHY", "INVALID_TREE")
    }
  }

  // Deterministic `-{n}` suffix (n = 2..999) per notion-article-node Req 9.2.
  private async uniqueRoadmapSlug(base: string): Promise<string> {
    if (!(await this.prisma.roadmap.findUnique({ where: { slug: base } }))) {
      return base
    }
    for (let n = 2; n <= 999; n++) {
      const candidate = `${base}-${n}`
      if (
        !(await this.prisma.roadmap.findUnique({ where: { slug: candidate } }))
      ) {
        return candidate
      }
    }
    throw new RoadmapError("TIMEOUT", "slug exhausted")
  }

  private async uniqueNodeSlug(base: string): Promise<string> {
    if (!(await this.prisma.node.findUnique({ where: { slug: base } }))) {
      return base
    }
    for (let n = 2; n <= 999; n++) {
      const candidate = `${base}-${n}`
      if (
        !(await this.prisma.node.findUnique({ where: { slug: candidate } }))
      ) {
        return candidate
      }
    }
    throw new RoadmapError("TIMEOUT", "slug exhausted")
  }

  /** Exposed for a NodeType allow-list sanity check if ever needed. */
  static readonly nodeTypes = NODE_TYPES
}
