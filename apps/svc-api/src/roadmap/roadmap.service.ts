import { Injectable, type OnModuleInit } from "@nestjs/common"
import type { Node as DbNode, Prisma } from "@prisma/client"

import { PrismaService } from "../prisma/prisma.service"
import { RoadmapEventsService } from "../sse/roadmap-events.service"
import { RoadmapError } from "../common/roadmap-error"
import { assertCanWrite, type CurrentUser } from "../auth/clerk"
import {
  MAX_TITLE_LENGTH,
  NODE_TYPES,
  isNodeType,
  normalizeHttpUrl,
  slugify,
  type ArticleType,
  type NodeStatus,
  type NodeType,
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
  isPublished: boolean
  nodeCount: number
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
  isPublished: boolean
  /**
   * Discovery labels. Empty when the caller's query did not `include` them —
   * the GraphQL field is a non-null list, so callers see `[]`, never null.
   */
  fields: FieldDto[]
}

export interface FieldDto {
  id: string
  name: string
  slug: string
  order: number
}

/** A `Node` row with its labels joined in. */
type DbNodeWithFields = DbNode & { fields?: FieldDto[] }

export interface GraphDto {
  roadmap: RoadmapDto
  nodes: NodeDto[]
}

export interface CreateRoadmapInput {
  slug: string
  title: string
  description?: string | null
  thumbnailUrl?: string | null
}

export interface UpdateRoadmapInput {
  title?: string | null
  description?: string | null
  thumbnailUrl?: string | null
  isPublished?: boolean | null
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
  isPublished?: boolean | null
  /** Replaces the whole label set when present; `undefined` leaves it alone. */
  fieldIds?: string[] | null
}

export interface SaveNodeInput {
  id: string
  parentId?: string | null
  positionX: number
  positionY: number
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
        await this.prisma.node.updateMany({
          where: {
            OR: [
              { notionPageId: doc.id },
              ...(doc.slug ? [{ slug: doc.slug }] : []),
            ],
            isPublished: !doc.isPublished,
          },
          data: { isPublished: doc.isPublished },
        })
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
      where: includeUnpublished && isAdmin ? {} : { isPublished: true },
      include: {
        _count: { select: { nodes: { where: { isDeleted: false } } } },
      },
      orderBy: { createdAt: "asc" },
    })
    return rows.map((r) => this.toRoadmapDto(r, r._count.nodes))
  }

  async roadmapBySlug(slug: string): Promise<RoadmapDto | null> {
    const r = await this.prisma.roadmap.findUnique({
      where: { slug },
      include: {
        _count: { select: { nodes: { where: { isDeleted: false } } } },
      },
    })
    return r ? this.toRoadmapDto(r, r._count.nodes) : null
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
    if (roadmap && (roadmap.isPublished || isAdmin)) {
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
      if (!node.isPublished && !parentRoadmap?.isPublished) return null
    }

    const subtree = await this.subtreeOf(node)
    const synthetic: RoadmapDto = {
      id: node.id,
      slug: node.slug,
      title: node.title,
      description: node.description,
      thumbnailUrl: null,
      isPublished: true,
      nodeCount: subtree.length,
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
          orderBy: [{ order: "asc" }, { name: "asc" }],
          select: { id: true, name: true, slug: true, order: true },
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
  async publicBlocks(fieldIds?: string[] | null): Promise<NodeDto[]> {
    // Every non-deleted node is fetched even when filtering, because
    // childrenCount counts children across the WHOLE tree — narrowing the
    // query by label would undercount a block whose children carry no labels.
    const all = await this.prisma.node.findMany({
      where: { isDeleted: false },
      orderBy: { order: "asc" },
      include: {
        fields: {
          orderBy: [{ order: "asc" }, { name: "asc" }],
          select: { id: true, name: true, slug: true, order: true },
        },
      },
    })
    const childCount = new Map<string, number>()
    for (const n of all) {
      if (n.parentId) {
        childCount.set(n.parentId, (childCount.get(n.parentId) ?? 0) + 1)
      }
    }
    // OR across labels: the strip selects one tab at a time, and a block
    // carrying both AI and Data must show up under either.
    const wanted = fieldIds?.length ? new Set(fieldIds) : null
    return all
      .filter(
        (n) =>
          n.isPublished && (n.nodeType === "role" || n.nodeType === "skill")
      )
      .filter((n) => !wanted || n.fields.some((f) => wanted.has(f.id)))
      .map((n) => this.toNodeDto(n, "locked", childCount.get(n.id) ?? 0))
  }

  /**
   * PUBLIC per-block composition (viewer ⇄ builder sync). Returns ONE block
   * (by node id) plus its DIRECT children — the same single-level canvas the
   * admin builder shows: block blocks render on the canvas, article children
   * feed the detail panel. Drilling into a member fetches ITS block graph.
   * No auth; the block (or its container roadmap) must be published.
   */
  async publicBlockGraph(id: string): Promise<GraphDto | null> {
    const node = await this.prisma.node.findUnique({ where: { id } })
    if (!node || node.isDeleted || node.nodeType === "article") return null
    if (!node.isPublished) {
      const parent = await this.prisma.roadmap.findUnique({
        where: { id: node.roadmapId },
      })
      if (!parent?.isPublished) return null
    }
    // Return the WHOLE roadmap's nodes so the web viewer derives the exact same
    // composition (deriveCompositionFromNodes) the admin builder renders — one
    // shared derive keeps viewer ⇄ builder in sync.
    const roadmapNodes = await this.prisma.node.findMany({
      where: { roadmapId: node.roadmapId, isDeleted: false },
      orderBy: { order: "asc" },
    })
    const synthetic: RoadmapDto = {
      id: node.id,
      slug: node.slug,
      title: node.title,
      description: node.description,
      thumbnailUrl: null,
      isPublished: true,
      nodeCount: roadmapNodes.length,
    }
    return this.buildGraph(synthetic, roadmapNodes, {})
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
    assertCanWrite(user)
    const slug = await this.uniqueRoadmapSlug(
      input.slug?.trim() || slugify(input.title)
    )
    const created = await this.prisma.roadmap.create({
      data: {
        slug,
        title: input.title.trim().slice(0, MAX_TITLE_LENGTH),
        description: input.description?.trim() || null,
        thumbnailUrl: input.thumbnailUrl ?? null,
        isPublished: false,
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
        isPublished:
          input.isPublished !== undefined && input.isPublished !== null
            ? input.isPublished
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
            positionX: input.positionX,
            positionY: input.positionY,
            order,
          },
          // Echo the labels back so the admin picker renders them straight
          // after create instead of blanking.
          include: {
            fields: {
              orderBy: [{ order: "asc" }, { name: "asc" }],
              select: { id: true, name: true, slug: true, order: true },
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
              isPublished:
                input.isPublished !== undefined && input.isPublished !== null
                  ? input.isPublished
                  : undefined,
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
                orderBy: [{ order: "asc" }, { name: "asc" }],
                select: { id: true, name: true, slug: true, order: true },
              },
            },
          })

          // Title sync only — publish lives on the Document editor (same
          // pattern as Jupyter notebook EditorToolbar), not on node edit.
          // Keep isPublished dual-write for callers that still set it.
          if (node.notionPageId) {
            const docData: { title?: string; isPublished?: boolean } = {}
            if (input.title != null) docData.title = u.title
            if (input.isPublished != null)
              docData.isPublished = input.isPublished
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
    return true
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  private toRoadmapDto(
    r: {
      id: string
      slug: string
      title: string
      description: string | null
      thumbnailUrl: string | null
      isPublished: boolean
      createdAt?: Date
      updatedAt?: Date
    },
    nodeCount: number
  ): RoadmapDto {
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description,
      thumbnailUrl: r.thumbnailUrl,
      isPublished: r.isPublished,
      nodeCount,
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
      isPublished: n.isPublished,
      fields: n.fields ?? [],
    }
  }

  // ── Discovery labels (Field) ───────────────────────────────────────────────

  /** Every label, for the public tab strip. No auth — labels are not secret. */
  async listFields(): Promise<FieldDto[]> {
    return this.prisma.field.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, order: true },
    })
  }

  /**
   * Find-or-create by name. The admin picker offers "create" inline, so two
   * admins typing "AI" and "ai" must land on ONE label — otherwise the tab
   * strip slowly fills with near-duplicates nobody can merge.
   */
  async createField(user: CurrentUser | null, name: string): Promise<FieldDto> {
    assertCanWrite(user)
    const trimmed = name.trim()
    if (!trimmed) throw new RoadmapError("VALIDATION", "Field name is required")

    const existing = await this.prisma.field.findFirst({
      where: { name: { equals: trimmed, mode: "insensitive" } },
      select: { id: true, name: true, slug: true, order: true },
    })
    if (existing) return existing

    const count = await this.prisma.field.count()
    return this.prisma.field.create({
      data: {
        name: trimmed,
        slug: await this.uniqueFieldSlug(trimmed),
        order: count,
      },
      select: { id: true, name: true, slug: true, order: true },
    })
  }

  /**
   * Rename in place. This is the whole reason labels are a table rather than a
   * string column on `Node`: one row changes and every block carrying the label
   * follows, with no bulk update and no chance of a half-renamed set.
   */
  async updateField(
    user: CurrentUser | null,
    id: string,
    name: string
  ): Promise<FieldDto> {
    assertCanWrite(user)
    const trimmed = name.trim()
    if (!trimmed) throw new RoadmapError("VALIDATION", "Field name is required")

    // Renaming onto another label's name would break the unique index with a
    // raw Prisma error; reject it as a domain failure instead.
    const clash = await this.prisma.field.findFirst({
      where: { name: { equals: trimmed, mode: "insensitive" }, id: { not: id } },
      select: { id: true },
    })
    if (clash) {
      throw new RoadmapError("VALIDATION", `Lĩnh vực "${trimmed}" đã tồn tại`)
    }

    return this.prisma.field.update({
      where: { id },
      // The slug is derived from the name, so it has to move with it or links
      // built from the old slug would point at a label that reads differently.
      data: { name: trimmed, slug: await this.uniqueFieldSlug(trimmed, id) },
      select: { id: true, name: true, slug: true, order: true },
    })
  }

  /** Drops the label; the join rows go with it, the blocks themselves stay. */
  async deleteField(user: CurrentUser | null, id: string): Promise<boolean> {
    assertCanWrite(user)
    await this.prisma.field.delete({ where: { id } })
    return true
  }

  /**
   * `excludeId` is the label being renamed: without it a rename that keeps the
   * same slug would collide with the row's own slug and get suffixed "-2".
   */
  private async uniqueFieldSlug(
    name: string,
    excludeId?: string
  ): Promise<string> {
    const base =
      name
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
    })
  }

  private async subtreeOf(root: DbNode): Promise<DbNode[]> {
    const all = await this.prisma.node.findMany({
      where: { roadmapId: root.roadmapId, isDeleted: false },
      orderBy: { order: "asc" },
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
