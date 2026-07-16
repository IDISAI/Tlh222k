import { Injectable } from "@nestjs/common"
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

type TreeClient = Pick<Prisma.TransactionClient, "node">

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  )
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
}

export interface SaveNodeInput {
  id: string
  parentId?: string | null
  positionX: number
  positionY: number
}

@Injectable()
export class RoadmapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: RoadmapEventsService
  ) {}

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
    const roadmap = await this.prisma.roadmap.findUnique({ where: { slug } })

    if (roadmap) {
      // Non-admin users (viewers/guests) must not see unpublished roadmaps.
      const isAdmin = user?.role === "admin" || user?.role === "super-admin"
      if (!roadmap.isPublished && !isAdmin) return null

      const nodes = await this.activeNodesOf(roadmap.id)
      return this.buildGraph(
        this.toRoadmapDto(roadmap, nodes.length),
        nodes,
        await this.progressMap(user, nodes)
      )
    }

    // Node-slug navigation: role/skill/chapter slug → node + its subtree
    // (chapter → its article children).
    const node = await this.prisma.node.findFirst({
      where: {
        slug,
        isDeleted: false,
        nodeType: { in: ["role", "skill", "chapter"] },
      },
    })
    if (!node) return null

    // The parent roadmap must be published for non-admin viewers.
    const isAdmin = user?.role === "admin" || user?.role === "super-admin"
    if (!isAdmin) {
      const parentRoadmap = await this.prisma.roadmap.findUnique({
        where: { id: node.roadmapId },
      })
      if (!parentRoadmap?.isPublished) return null
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

  /** Builder graph by id — includes soft-deleted ghost nodes (Req 4.4). */
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
      where: { roadmapId: id },
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
    const nodes = await this.prisma.node.findMany({ orderBy: { order: "asc" } })
    return this.attachComputed(nodes, {})
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
    this.events.emit(created.id)
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
    this.events.emit(id)
    return this.toRoadmapDto(updated, updated._count.nodes)
  }

  async deleteRoadmap(id: string, user: CurrentUser | null): Promise<boolean> {
    assertCanWrite(user)
    const existing = await this.prisma.roadmap.findUnique({ where: { id } })
    if (!existing) throw new RoadmapError("NOT_FOUND")
    await this.prisma.roadmap.delete({ where: { id } }) // cascade deletes nodes
    this.events.emit(id)
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
    const created = await this.prisma.$transaction(async (tx) => {
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
          positionX: input.positionX,
          positionY: input.positionY,
          order,
        },
      })
    }, TREE_TRANSACTION_OPTIONS)
    this.events.emit(input.roadmapId)
    return this.toNodeDto(created, "locked", 0)
  }

  async updateNode(
    id: string,
    input: UpdateNodeInput,
    user: CurrentUser | null
  ): Promise<NodeDto> {
    assertCanWrite(user)
    const updated = await this.prisma.$transaction(async (tx) => {
      const node = await tx.node.findUnique({ where: { id } })
      if (!node || node.isDeleted) throw new RoadmapError("NOT_FOUND")

      if (input.parentId !== undefined && input.parentId !== node.parentId) {
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
            input.parentId !== undefined ? (input.parentId ?? null) : undefined,
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
        },
      })

      // Atomic cross-link: a notion node's title/publish change must not drift
      // from its linked Document. Same transaction as the node write, so both
      // commit or neither does. updateMany is a no-op when no doc is linked.
      if (node.notionPageId) {
        const docData: { title?: string; isPublished?: boolean } = {}
        if (input.title != null) docData.title = u.title
        if (input.isPublished != null) docData.isPublished = input.isPublished
        if (Object.keys(docData).length > 0) {
          await tx.document.updateMany({
            where: { id: node.notionPageId },
            data: docData,
          })
        }
      }
      return u
    }, TREE_TRANSACTION_OPTIONS)
    this.events.emit(updated.roadmapId)
    const childrenCount = await this.childrenCount(id)
    return this.toNodeDto(updated, "locked", childrenCount)
  }

  /** Permanent delete = soft-flag the node and its whole subtree (Req 4.3). */
  async deleteNode(id: string, user: CurrentUser | null): Promise<boolean> {
    assertCanWrite(user)
    const node = await this.prisma.node.findUnique({ where: { id } })
    if (!node) throw new RoadmapError("NOT_FOUND")
    const doomed = await this.collectSubtreeIds(id)

    await this.prisma.$transaction(async (tx) => {
      // Archive the Documents linked to the doomed notion nodes in the same
      // transaction as the soft-delete, so a node delete and its doc archive
      // can't diverge.
      const doomedNodes = await tx.node.findMany({
        where: { id: { in: [...doomed] } },
        select: { notionPageId: true },
      })
      const docIds = doomedNodes
        .map((n) => n.notionPageId)
        .filter((v): v is string => Boolean(v))

      await tx.node.updateMany({
        where: { id: { in: [...doomed] } },
        data: { isDeleted: true },
      })
      if (docIds.length > 0) {
        await tx.document.updateMany({
          where: { id: { in: docIds } },
          data: { isArchived: true },
        })
      }
    })
    this.events.emit(node.roadmapId)
    return true
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
    this.events.emit(roadmapId) // ≤500ms after the write (Req 8.3)
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
    n: DbNode,
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
    }
  }

  private attachComputed(
    nodes: DbNode[],
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

  private async collectSubtreeIds(rootId: string): Promise<Set<string>> {
    const all = await this.prisma.node.findMany({
      select: { id: true, parentId: true },
    })
    const doomed = new Set<string>([rootId])
    let grew = true
    while (grew) {
      grew = false
      for (const n of all) {
        if (n.parentId && doomed.has(n.parentId) && !doomed.has(n.id)) {
          doomed.add(n.id)
          grew = true
        }
      }
    }
    return doomed
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
