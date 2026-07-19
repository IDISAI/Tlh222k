import {
  MAX_CHILDREN,
  MAX_TITLE_LENGTH,
  NODE_TYPES,
  RoadmapServiceError,
  type CallerRole,
  type CreateNodeInput,
  type CreateRoadmapInput,
  type NodeStatus,
  type Roadmap,
  type RoadmapGraph,
  type RoadmapNode,
  type UpdateNodeInput,
} from "./types"
import { getStore, persistStore } from "./mock/builder-store"
import { emitRoadmapUpdate } from "./utils/update-signal"
import { slugify, uniqueSlug } from "./utils/slugify"
import { validateHierarchy } from "./utils/validate-hierarchy"

const LATENCY_MS = 150
const delay = (ms = LATENCY_MS) => new Promise((r) => setTimeout(r, ms))

/** Save mutations must settle within 10s (Req 3.10/3.11). */
const SAVE_TIMEOUT_MS = 10_000

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new RoadmapServiceError("TIMEOUT")),
      ms
    )
  })
  try {
    return await Promise.race([work, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/** Every write requires admin | super-admin (Req 1.4/1.5). */
function assertCanWrite(callerRole: CallerRole): void {
  if (callerRole !== "admin" && callerRole !== "super-admin") {
    throw new RoadmapServiceError("PERMISSION_DENIED")
  }
}

const newId = (prefix: string): string =>
  `${prefix}-${
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  }`

/**
 * Roadmap domain service. Currently mock-backed; each method maps 1:1 onto a
 * GraphQL operation (see graphql/operations.graphql) so the body can be
 * swapped for Apollo calls without touching callers.
 */
export class RoadmapService {
  // ponytail: → `roadmaps` query
  async list(): Promise<Roadmap[]> {
    await delay()
    return getStore().roadmaps.filter((r) => r.isPublished)
  }

  // ponytail: → `roadmaps(includeUnpublished: true)` query — admin list (Req 1.1)
  async listAdmin(callerRole: CallerRole): Promise<Roadmap[]> {
    assertCanWrite(callerRole)
    await delay()
    return getStore().roadmaps.map((r) => ({
      ...r,
      nodeCount: this.activeNodesOf(r.id).length,
    }))
  }

  // ponytail: → `roadmap(slug)` query
  async bySlug(slug: string): Promise<Roadmap | null> {
    await delay()
    return getStore().roadmaps.find((r) => r.slug === slug) ?? null
  }

  /**
   * Full graph for a roadmap. Guests (`authenticated: false`) always receive
   * every node "locked" (Property 4). Authenticated viewers get their persisted
   * status overlaid from `progress`.
   *
   * The slug may also be a **role/skill node slug** (Req 6.1/6.2): those
   * resolve to a synthetic sub-roadmap containing the node and everything
   * below it.
   * ponytail: → `roadmapGraph(slug)` query (status personalized server-side)
   */
  async graphBySlug(
    slug: string,
    opts: { authenticated: boolean; progress?: Record<string, NodeStatus> } = {
      authenticated: false,
    }
  ): Promise<RoadmapGraph | null> {
    await delay()
    const store = getStore()
    const roadmap = store.roadmaps.find((r) => r.slug === slug)

    let base: { roadmap: Roadmap; nodes: RoadmapNode[] } | null = null
    if (roadmap) {
      base = { roadmap, nodes: this.activeNodesOf(roadmap.id) }
    } else {
      // Node-slug navigation: role/skill/chapter nodes expose their inner
      // structure (chapter → its article children).
      const node = store.nodes.find(
        (n) =>
          n.slug === slug &&
          !n.isDeleted &&
          (n.nodeType === "role" ||
            n.nodeType === "skill" ||
            n.nodeType === "chapter")
      )
      if (node) {
        const subtree = [node, ...this.descendantsOf(node.id)].filter(
          (n) => !n.isDeleted
        )
        base = {
          roadmap: {
            id: node.id,
            slug: node.slug,
            title: node.title,
            description: node.description,
            thumbnailUrl: null,
            isPublished: true,
            nodeCount: subtree.length,
          },
          nodes: subtree,
        }
      }
    }
    if (!base) return null

    const nodes: RoadmapNode[] = base.nodes.map((n) => ({
      ...n,
      status: opts.authenticated ? (opts.progress?.[n.id] ?? "locked") : "locked",
    }))
    return { roadmap: base.roadmap, nodes }
  }

  /**
   * Builder graph by roadmap id. Soft-deleted nodes are excluded — they never
   * render on the canvas, not even as disabled ghosts.
   * ponytail: → `roadmapGraphById(id)` query
   */
  async graphById(
    id: string,
    opts: { callerRole: CallerRole }
  ): Promise<RoadmapGraph | null> {
    assertCanWrite(opts.callerRole)
    await delay()
    const roadmap = getStore().roadmaps.find((r) => r.id === id)
    if (!roadmap) return null
    const nodes = getStore()
      .nodes.filter((n) => n.roadmapId === id && !n.isDeleted)
      .map((n) => ({ ...n }))
    return { roadmap, nodes }
  }

  /** All nodes in the system for the builder sidebar (Req 3.6, incl. deleted). */
  // ponytail: → `allNodes` query
  async listNodes(): Promise<RoadmapNode[]> {
    await delay()
    return getStore().nodes.map((n) => ({ ...n }))
  }

  // ── Admin mutations (Req 1.4) ─────────────────────────────────────────────

  // ponytail: → `createRoadmap` mutation
  async createRoadmap(
    input: CreateRoadmapInput,
    callerRole: CallerRole
  ): Promise<Roadmap> {
    assertCanWrite(callerRole)
    await delay()
    const store = getStore()
    const now = new Date().toISOString()
    const slug = input.slug.trim() || slugify(input.title)
    const roadmap: Roadmap = {
      id: newId("rm"),
      slug: uniqueSlug(slug, (s) => store.roadmaps.some((r) => r.slug === s)),
      title: input.title.trim().slice(0, MAX_TITLE_LENGTH),
      description: input.description?.trim() || null,
      thumbnailUrl: input.thumbnailUrl ?? null,
      isPublished: false,
      nodeCount: 0,
      createdAt: now,
      updatedAt: now,
      authorId: input.authorId,
    }
    store.roadmaps.push(roadmap)
    persistStore()
    emitRoadmapUpdate(roadmap.id)
    return { ...roadmap }
  }

  // ponytail: → `updateRoadmap` mutation
  async updateRoadmap(
    id: string,
    input: Partial<CreateRoadmapInput> & { isPublished?: boolean },
    callerRole: CallerRole
  ): Promise<Roadmap> {
    assertCanWrite(callerRole)
    await delay()
    const roadmap = getStore().roadmaps.find((r) => r.id === id)
    if (!roadmap) throw new RoadmapServiceError("NOT_FOUND")
    if (input.title !== undefined) {
      roadmap.title = input.title.trim().slice(0, MAX_TITLE_LENGTH)
    }
    if (input.description !== undefined) {
      roadmap.description = input.description.trim() || null
    }
    if (input.thumbnailUrl !== undefined) {
      roadmap.thumbnailUrl = input.thumbnailUrl || null
    }
    if (input.isPublished !== undefined) roadmap.isPublished = input.isPublished
    roadmap.updatedAt = new Date().toISOString() // bump on every write
    persistStore()
    emitRoadmapUpdate(id)
    return { ...roadmap }
  }

  // ponytail: → `deleteRoadmap` mutation (cascade)
  async deleteRoadmap(id: string, callerRole: CallerRole): Promise<boolean> {
    assertCanWrite(callerRole)
    await delay()
    const store = getStore()
    const index = store.roadmaps.findIndex((r) => r.id === id)
    if (index === -1) throw new RoadmapServiceError("NOT_FOUND")
    store.roadmaps.splice(index, 1)
    store.nodes = store.nodes.filter((n) => n.roadmapId !== id)
    persistStore()
    emitRoadmapUpdate(id)
    return true
  }

  // ponytail: → `createNode` mutation
  async createNode(
    input: CreateNodeInput,
    callerRole: CallerRole
  ): Promise<RoadmapNode> {
    assertCanWrite(callerRole)

    if (!NODE_TYPES.includes(input.nodeType)) {
      throw new RoadmapServiceError("INVALID_NODE_TYPE")
    }
    this.validateParent(input.parentId ?? null, input.nodeType)

    await delay()
    const store = getStore()
    const title = input.title.trim().slice(0, MAX_TITLE_LENGTH)
    const baseSlug = input.slug?.trim() || slugify(title)
    const node: RoadmapNode = {
      id: newId("nd"),
      roadmapId: input.roadmapId,
      parentId: input.parentId ?? null,
      title,
      slug: uniqueSlug(baseSlug, (s) => store.nodes.some((n) => n.slug === s)),
      nodeType: input.nodeType,
      description: input.description?.trim() || null,
      notionPageId: input.notionPageId ?? null,
      articleType: input.articleType ?? null,
      jupyterUrl: input.jupyterUrl ?? null,
      positionX: input.positionX,
      positionY: input.positionY,
      order: input.order ?? store.nodes.filter((n) => n.roadmapId === input.roadmapId).length,
      status: "locked",
    }
    store.nodes.push(node)
    persistStore()
    emitRoadmapUpdate(input.roadmapId)
    return { ...node }
  }

  // ponytail: → `updateNode` mutation
  async updateNode(
    id: string,
    input: UpdateNodeInput,
    callerRole: CallerRole
  ): Promise<RoadmapNode> {
    assertCanWrite(callerRole)
    await delay()
    const node = getStore().nodes.find((n) => n.id === id)
    if (!node || node.isDeleted) throw new RoadmapServiceError("NOT_FOUND")

    if (input.parentId !== undefined && input.parentId !== node.parentId) {
      this.validateParent(input.parentId ?? null, node.nodeType, id)
      node.parentId = input.parentId ?? null
    }
    if (input.title !== undefined) {
      node.title = input.title.trim().slice(0, MAX_TITLE_LENGTH)
    }
    if (input.description !== undefined) {
      node.description = input.description.trim() || null
    }
    if (input.articleType !== undefined) node.articleType = input.articleType ?? null
    if (input.notionPageId !== undefined) {
      node.notionPageId = input.notionPageId?.trim() || null
    }
    if (input.jupyterUrl !== undefined) {
      node.jupyterUrl = input.jupyterUrl?.trim() || null
    }
    if (input.positionX !== undefined) node.positionX = input.positionX
    if (input.positionY !== undefined) node.positionY = input.positionY
    if (input.order !== undefined) node.order = input.order
    if (input.linkedRoadmapId !== undefined) {
      node.linkedRoadmapId = input.linkedRoadmapId ?? null
    }
    if (input.isPublished !== undefined) node.isPublished = input.isPublished

    persistStore()
    emitRoadmapUpdate(node.roadmapId)
    return { ...node }
  }

  /**
   * Move a node into another roadmap (sidebar drag-drop). No clone: the node
   * keeps its identity and slug — it just changes owner. Children left behind
   * in the source roadmap are detached.
   */
  // ponytail: → `moveNode` mutation
  async moveNode(
    nodeId: string,
    roadmapId: string,
    position: { x: number; y: number },
    callerRole: CallerRole
  ): Promise<RoadmapNode> {
    assertCanWrite(callerRole)
    await delay()
    const store = getStore()
    const node = store.nodes.find((n) => n.id === nodeId)
    if (!node || node.isDeleted) throw new RoadmapServiceError("NOT_FOUND")
    const target = store.roadmaps.find((r) => r.id === roadmapId)
    if (!target) throw new RoadmapServiceError("NOT_FOUND")
    const sourceRoadmapId = node.roadmapId

    for (const n of store.nodes) {
      if (n.parentId === nodeId) n.parentId = null
    }
    node.roadmapId = roadmapId
    node.parentId = null
    node.positionX = position.x
    node.positionY = position.y
    persistStore()
    emitRoadmapUpdate(sourceRoadmapId)
    if (sourceRoadmapId !== roadmapId) emitRoadmapUpdate(roadmapId)
    return { ...node }
  }

  /**
   * Permanent delete of a SINGLE node. Direct children survive: they reparent
   * up to the deleted node's parent so a sub-roadmap is never lost when its
   * parent roadmap is deleted.
   */
  // ponytail: → `deleteNode` mutation (reparent children up)
  async deleteNode(id: string, callerRole: CallerRole): Promise<boolean> {
    assertCanWrite(callerRole)
    await delay()
    const store = getStore()
    const node = store.nodes.find((n) => n.id === id)
    if (!node) throw new RoadmapServiceError("NOT_FOUND")
    const newParent = node.parentId ?? null
    for (const n of store.nodes) {
      if (n.parentId === id) n.parentId = newParent
    }
    node.isDeleted = true
    persistStore()
    emitRoadmapUpdate(node.roadmapId)
    return true
  }

  /**
   * Persist the whole canvas state — nodes, parent links (edges) and
   * positions — in one batch (Req 3.10). Replaces the roadmap's active nodes.
   */
  // ponytail: → `saveRoadmap` mutation (batch nodes + edges)
  async saveRoadmap(
    roadmapId: string,
    nodes: RoadmapNode[],
    callerRole: CallerRole
  ): Promise<boolean> {
    assertCanWrite(callerRole)

    return withTimeout(
      (async () => {
        await delay()
        const store = getStore()
        const roadmap = store.roadmaps.find((r) => r.id === roadmapId)
        if (!roadmap) throw new RoadmapServiceError("NOT_FOUND")

        const incoming = nodes
          .filter((n) => !n.isDeleted)
          .map((n) => ({ ...n, roadmapId }))
        const incomingIds = new Set(incoming.map((n) => n.id))
        // Keep other roadmaps' nodes and this roadmap's soft-deleted ghosts
        // that the admin has not explicitly removed from the canvas.
        store.nodes = [
          ...store.nodes.filter(
            (n) =>
              n.roadmapId !== roadmapId ||
              (n.isDeleted === true && !incomingIds.has(n.id))
          ),
          ...incoming,
        ]
        roadmap.nodeCount = incoming.length
        persistStore()
        emitRoadmapUpdate(roadmapId) // ≤500ms after the write (Req 8.3)
        return true
      })(),
      SAVE_TIMEOUT_MS
    )
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private activeNodesOf(roadmapId: string): RoadmapNode[] {
    return getStore()
      .nodes.filter((n) => n.roadmapId === roadmapId && !n.isDeleted)
      .map((n) => ({ ...n }))
  }

  private descendantsOf(id: string): RoadmapNode[] {
    const all = getStore().nodes
    const result: RoadmapNode[] = []
    const queue = [id]
    while (queue.length) {
      const current = queue.shift() as string
      for (const n of all) {
        if (n.parentId === current) {
          result.push(n)
          queue.push(n.id)
        }
      }
    }
    return result
  }

  /**
   * Shared parent checks for create/update. `article` may attach under any
   * level and may have `article` children (see validateHierarchy); every other
   * link must be level + 1. The 100-children limit still applies.
   */
  private validateParent(
    parentId: string | null,
    childType: RoadmapNode["nodeType"],
    selfId?: string
  ): void {
    if (!parentId) return
    const store = getStore()
    const parent = store.nodes.find((n) => n.id === parentId && !n.isDeleted)
    if (!parent) throw new RoadmapServiceError("NOT_FOUND")
    if (!validateHierarchy(parent.nodeType, childType)) {
      throw new RoadmapServiceError(
        "INVALID_HIERARCHY",
        `${parent.nodeType} → ${childType}`
      )
    }
    const childCount = store.nodes.filter(
      (n) => n.parentId === parentId && !n.isDeleted && n.id !== selfId
    ).length
    if (childCount >= MAX_CHILDREN) {
      throw new RoadmapServiceError("CHILDREN_LIMIT_EXCEEDED")
    }
  }
}
