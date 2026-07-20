import {
  BLOCK_TYPES,
  MAX_CHILDREN,
  MAX_TITLE_LENGTH,
  NODE_TYPES,
  RoadmapServiceError,
  type ArticleType,
  type CallerRole,
  type Composition,
  type CreateNodeInput,
  type CreateRoadmapInput,
  type EdgeKind,
  type NodeStatus,
  type NodeType,
  type Roadmap,
  type RoadmapEdge,
  type RoadmapGraph,
  type RoadmapNode,
  type UpdateNodeInput,
} from "./types"
import { getStore, persistStore } from "./mock/builder-store"
import { deriveCompositionFromNodes } from "./utils/derive-composition"
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

/** Deep copy so callers never mutate the live store by reference. */
const clone = <T>(value: T): T =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T)

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

  // ── Composition / edges (LEGO model) ──────────────────────────────────────

  /**
   * An owner block's canvas (members + edges). Falls back to DERIVING one from
   * the legacy parentId tree — direct non-article children become members with
   * an owner→child solid edge — so seed data shows up without a migration. The
   * derived shape is not persisted until the first mutating call.
   * ponytail: → `composition(ownerId)` query when the backend lands.
   */
  async getComposition(
    ownerId: string,
    opts: { callerRole: CallerRole }
  ): Promise<Composition> {
    assertCanWrite(opts.callerRole)
    await delay()
    return clone(this.readComposition(ownerId))
  }

  /** Add an existing block to an owner's canvas (sidebar drag / drop). */
  // ponytail: → `addMember` mutation
  async addMember(
    ownerId: string,
    nodeId: string,
    position: { x: number; y: number },
    callerRole: CallerRole
  ): Promise<Composition> {
    assertCanWrite(callerRole)
    await delay()
    const store = getStore()
    const block = store.nodes.find((n) => n.id === nodeId && !n.isDeleted)
    if (!block) throw new RoadmapServiceError("NOT_FOUND")
    if (block.nodeType === "article") {
      throw new RoadmapServiceError("INVALID_NODE_TYPE")
    }
    // A block cannot sit on its own canvas (it already renders as the owner).
    if (nodeId === ownerId) throw new RoadmapServiceError("INVALID_HIERARCHY")
    const comp = this.mutableComposition(ownerId)
    if (!comp.members.some((m) => m.nodeId === nodeId)) {
      comp.members.push({ nodeId, x: position.x, y: position.y })
    }
    persistStore()
    emitRoadmapUpdate(ownerId)
    return clone(comp)
  }

  /**
   * Remove a block from an owner's canvas (delete-from-canvas). Only membership
   * and the edges touching THIS block are dropped — every other edge and the
   * block itself survive (LEGO independence).
   */
  // ponytail: → `removeMember` mutation
  async removeFromCanvas(
    ownerId: string,
    nodeId: string,
    callerRole: CallerRole
  ): Promise<Composition> {
    assertCanWrite(callerRole)
    await delay()
    const comp = this.mutableComposition(ownerId)
    comp.members = comp.members.filter((m) => m.nodeId !== nodeId)
    comp.edges = comp.edges.filter(
      (e) => e.sourceId !== nodeId && e.targetId !== nodeId
    )
    persistStore()
    emitRoadmapUpdate(ownerId)
    return clone(comp)
  }

  /** Persist a member's dragged position on an owner's canvas. */
  // ponytail: → `moveMember` mutation
  async moveMember(
    ownerId: string,
    nodeId: string,
    position: { x: number; y: number },
    callerRole: CallerRole
  ): Promise<void> {
    assertCanWrite(callerRole)
    await delay()
    const comp = this.mutableComposition(ownerId)
    const member = comp.members.find((m) => m.nodeId === nodeId)
    if (member) {
      member.x = position.x
      member.y = position.y
      persistStore()
    }
  }

  /**
   * Create a brand-new block (role/skill/chapter) and place it on the owner's
   * canvas. A block has no parent and owns itself (`roadmapId === id`) — it IS a
   * roadmap. `ownerId` omitted just creates a free-floating block.
   */
  // ponytail: → `createBlock` mutation
  async createBlock(
    input: {
      nodeType: NodeType
      title: string
      description?: string
      ownerId?: string
      positionX: number
      positionY: number
    },
    callerRole: CallerRole
  ): Promise<RoadmapNode> {
    assertCanWrite(callerRole)
    if (!BLOCK_TYPES.includes(input.nodeType)) {
      throw new RoadmapServiceError("INVALID_NODE_TYPE")
    }
    await delay()
    const store = getStore()
    const id = newId("nd")
    const title = input.title.trim().slice(0, MAX_TITLE_LENGTH)
    const node: RoadmapNode = {
      id,
      roadmapId: id, // self-owned: the block IS its own roadmap
      parentId: null,
      title,
      slug: uniqueSlug(slugify(title), (s) =>
        store.nodes.some((n) => n.slug === s)
      ),
      nodeType: input.nodeType,
      description: input.description?.trim() || null,
      notionPageId: null,
      articleType: null,
      jupyterUrl: null,
      positionX: input.positionX,
      positionY: input.positionY,
      order: store.nodes.length,
      status: "locked",
    }
    store.nodes.push(node)
    if (input.ownerId) {
      const comp = this.mutableComposition(input.ownerId)
      comp.members.push({
        nodeId: id,
        x: input.positionX,
        y: input.positionY,
      })
    }
    persistStore()
    emitRoadmapUpdate(input.ownerId ?? id)
    return { ...node }
  }

  /**
   * Permanent system delete (sidebar / table "Xóa"). The block is soft-deleted
   * and purged from EVERY composition (as owner, member, and edge endpoint).
   * Other independent blocks are never deleted — only their link to this one.
   */
  // ponytail: → `deleteBlock` mutation
  async deleteBlockPermanent(
    nodeId: string,
    callerRole: CallerRole
  ): Promise<boolean> {
    assertCanWrite(callerRole)
    await delay()
    const store = getStore()
    const node = store.nodes.find((n) => n.id === nodeId)
    if (!node) throw new RoadmapServiceError("NOT_FOUND")
    node.isDeleted = true
    for (const comp of store.compositions) {
      comp.members = comp.members.filter((m) => m.nodeId !== nodeId)
      comp.edges = comp.edges.filter(
        (e) => e.sourceId !== nodeId && e.targetId !== nodeId
      )
    }
    store.compositions = store.compositions.filter((c) => c.ownerId !== nodeId)
    persistStore()
    emitRoadmapUpdate(node.roadmapId)
    return true
  }

  /** Draw a wire between two blocks on an owner's canvas (upserts by pair). */
  // ponytail: → `addEdge` mutation
  async addEdge(
    ownerId: string,
    sourceId: string,
    targetId: string,
    kind: EdgeKind,
    callerRole: CallerRole
  ): Promise<RoadmapEdge> {
    assertCanWrite(callerRole)
    if (sourceId === targetId) {
      throw new RoadmapServiceError("INVALID_HIERARCHY")
    }
    await delay()
    const comp = this.mutableComposition(ownerId)
    const existing = comp.edges.find(
      (e) => e.sourceId === sourceId && e.targetId === targetId
    )
    if (existing) {
      existing.kind = kind
      persistStore()
      emitRoadmapUpdate(ownerId)
      return clone(existing)
    }
    const edge: RoadmapEdge = { id: newId("edge"), sourceId, targetId, kind }
    comp.edges.push(edge)
    persistStore()
    emitRoadmapUpdate(ownerId)
    return clone(edge)
  }

  /** Change a wire's kind (right-click → "loại dây"). */
  // ponytail: → `updateEdge` mutation
  async updateEdgeKind(
    ownerId: string,
    edgeId: string,
    kind: EdgeKind,
    callerRole: CallerRole
  ): Promise<RoadmapEdge> {
    assertCanWrite(callerRole)
    await delay()
    const comp = this.mutableComposition(ownerId)
    const edge = comp.edges.find((e) => e.id === edgeId)
    if (!edge) throw new RoadmapServiceError("NOT_FOUND")
    edge.kind = kind
    persistStore()
    emitRoadmapUpdate(ownerId)
    return clone(edge)
  }

  /** Cut a wire (right-click → "hủy liên kết"). */
  // ponytail: → `removeEdge` mutation
  async removeEdge(
    ownerId: string,
    edgeId: string,
    callerRole: CallerRole
  ): Promise<Composition> {
    assertCanWrite(callerRole)
    await delay()
    const comp = this.mutableComposition(ownerId)
    comp.edges = comp.edges.filter((e) => e.id !== edgeId)
    persistStore()
    emitRoadmapUpdate(ownerId)
    return clone(comp)
  }

  /** Overwrite a stored composition (used by undo/redo to restore a snapshot). */
  async restoreComposition(
    ownerId: string,
    comp: Composition,
    callerRole: CallerRole
  ): Promise<void> {
    assertCanWrite(callerRole)
    const store = getStore()
    const idx = store.compositions.findIndex((c) => c.ownerId === ownerId)
    if (idx !== -1) store.compositions[idx] = comp
    else store.compositions.push(comp)
    persistStore()
    emitRoadmapUpdate(ownerId)
  }

  /** Create an article leaf under a chapter block. */
  async createArticle(
    input: {
      chapterId: string
      title: string
      articleType: ArticleType
    },
    callerRole: CallerRole
  ): Promise<RoadmapNode> {
    const chapter = getStore().nodes.find(
      (n) => n.id === input.chapterId && !n.isDeleted
    )
    if (!chapter) throw new RoadmapServiceError("NOT_FOUND")
    return this.createNode(
      {
        roadmapId: chapter.roadmapId,
        parentId: input.chapterId,
        title: input.title,
        nodeType: "article",
        articleType: input.articleType,
        positionX: 0,
        positionY: 0,
      },
      callerRole
    )
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  /** Read-only composition: stored if present, else derived from the tree. */
  private readComposition(ownerId: string): Composition {
    const stored = getStore().compositions.find((c) => c.ownerId === ownerId)
    return stored ?? this.deriveComposition(ownerId)
  }

  /** Bridge the legacy parentId tree into a composition (shared derive). */
  private deriveComposition(ownerId: string): Composition {
    return deriveCompositionFromNodes(ownerId, getStore().nodes)
  }

  /**
   * Get the owner's stored composition, materializing (and persisting on the
   * next `persistStore`) the derived one on first edit.
   */
  private mutableComposition(ownerId: string): Composition {
    const store = getStore()
    let comp = store.compositions.find((c) => c.ownerId === ownerId)
    if (!comp) {
      comp = this.deriveComposition(ownerId)
      store.compositions.push(comp)
    }
    return comp
  }

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
