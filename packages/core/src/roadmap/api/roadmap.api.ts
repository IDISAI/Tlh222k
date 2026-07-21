import type {
  ArticleType,
  CallerRole,
  Composition,
  CreateNodeInput,
  CreateRoadmapInput,
  EdgeKind,
  NodeStatus,
  NodeType,
  Roadmap,
  RoadmapEdge,
  RoadmapGraph,
  RoadmapNode,
  UpdateNodeInput,
} from "../types"
import {
  deriveCompositionFromNodes,
  parseDerivedEdge,
} from "../utils/derive-composition"
import { slugify } from "../utils/slugify"
import { gql } from "./client"

// Field selections matching the domain types (childrenCount is server-only).
const ROADMAP_FIELDS = `
  id slug title description thumbnailUrl isPublished nodeCount createdAt updatedAt
`
const NODE_FIELDS = `
  id roadmapId parentId title slug description nodeType notionPageId
  articleType jupyterUrl positionX positionY order status isDeleted
  linkedRoadmapId isPublished
`

/**
 * Backend-backed implementation of the roadmap domain service. Public methods
 * mirror the mock `RoadmapService` 1:1 so every call site is unchanged. Auth is
 * derived from the Clerk token attached by the client, so the `callerRole` /
 * `authenticated` params are accepted for compatibility but not sent.
 */
export class RoadmapApi {
  async list(): Promise<Roadmap[]> {
    // LEGO: the public home lists every published role/skill block (a block IS a
    // roadmap), mapped onto the card shape. See svc-api `publicBlocks`.
    const data = await gql<{
      publicBlocks: {
        id: string
        slug: string
        title: string
        description: string | null
        childrenCount: number
      }[]
    }>(`query { publicBlocks { id slug title description childrenCount } }`)
    return data.publicBlocks.map((n) => ({
      id: n.id,
      slug: n.slug,
      title: n.title,
      description: n.description,
      thumbnailUrl: null,
      isPublished: true,
      nodeCount: n.childrenCount ?? 0,
    }))
  }

  async listAdmin(_callerRole: CallerRole): Promise<Roadmap[]> {
    const data = await gql<{ roadmaps: Roadmap[] }>(
      `query { roadmaps(includeUnpublished: true) { ${ROADMAP_FIELDS} } }`
    )
    return data.roadmaps
  }

  async bySlug(slug: string): Promise<Roadmap | null> {
    const data = await gql<{ roadmap: Roadmap | null }>(
      `query ($slug: String!) { roadmap(slug: $slug) { ${ROADMAP_FIELDS} } }`,
      { slug }
    )
    return data.roadmap
  }

  async graphBySlug(
    slug: string,
    _opts: { authenticated: boolean; progress?: Record<string, NodeStatus> } = {
      authenticated: false,
    }
  ): Promise<RoadmapGraph | null> {
    const data = await gql<{ roadmapGraph: RoadmapGraph | null }>(
      `query ($slug: String!) {
         roadmapGraph(slug: $slug) {
           roadmap { ${ROADMAP_FIELDS} }
           nodes { ${NODE_FIELDS} }
         }
       }`,
      { slug }
    )
    return data.roadmapGraph
  }

  async graphById(
    id: string,
    _opts: { callerRole: CallerRole }
  ): Promise<RoadmapGraph | null> {
    const data = await gql<{ roadmapGraphById: RoadmapGraph | null }>(
      `query ($id: ID!) {
         roadmapGraphById(id: $id) {
           roadmap { ${ROADMAP_FIELDS} }
           nodes { ${NODE_FIELDS} }
         }
       }`,
      { id }
    )
    return data.roadmapGraphById
  }

  async listNodes(): Promise<RoadmapNode[]> {
    const data = await gql<{ allNodes: RoadmapNode[] }>(
      `query { allNodes { ${NODE_FIELDS} } }`
    )
    return data.allNodes
  }

  async publicBlockGraph(id: string): Promise<RoadmapGraph | null> {
    const data = await gql<{ publicBlockGraph: RoadmapGraph | null }>(
      `query ($id: ID!) {
         publicBlockGraph(id: $id) {
           roadmap { ${ROADMAP_FIELDS} }
           nodes { ${NODE_FIELDS} }
         }
       }`,
      { id }
    )
    return data.publicBlockGraph
  }

  async createRoadmap(
    input: CreateRoadmapInput,
    _callerRole: CallerRole
  ): Promise<Roadmap> {
    const data = await gql<{ createRoadmap: Roadmap }>(
      `mutation ($input: CreateRoadmapInput!) {
         createRoadmap(input: $input) { ${ROADMAP_FIELDS} }
       }`,
      { input }
    )
    return data.createRoadmap
  }

  async updateRoadmap(
    id: string,
    input: Partial<CreateRoadmapInput> & { isPublished?: boolean },
    _callerRole: CallerRole
  ): Promise<Roadmap> {
    const data = await gql<{ updateRoadmap: Roadmap }>(
      `mutation ($id: ID!, $input: UpdateRoadmapInput!) {
         updateRoadmap(id: $id, input: $input) { ${ROADMAP_FIELDS} }
       }`,
      { id, input }
    )
    return data.updateRoadmap
  }

  async deleteRoadmap(id: string, _callerRole: CallerRole): Promise<boolean> {
    const data = await gql<{ deleteRoadmap: boolean }>(
      `mutation ($id: ID!) { deleteRoadmap(id: $id) }`,
      { id }
    )
    return data.deleteRoadmap
  }

  async createNode(
    input: CreateNodeInput,
    _callerRole: CallerRole
  ): Promise<RoadmapNode> {
    const data = await gql<{ createNode: RoadmapNode }>(
      `mutation ($input: CreateNodeInput!) {
         createNode(input: $input) { ${NODE_FIELDS} }
       }`,
      { input }
    )
    return data.createNode
  }

  async updateNode(
    id: string,
    input: UpdateNodeInput,
    _callerRole: CallerRole
  ): Promise<RoadmapNode> {
    const data = await gql<{ updateNode: RoadmapNode }>(
      `mutation ($id: ID!, $input: UpdateNodeInput!) {
         updateNode(id: $id, input: $input) { ${NODE_FIELDS} }
       }`,
      { id, input }
    )
    return data.updateNode
  }

  async deleteNode(id: string, _callerRole: CallerRole): Promise<boolean> {
    const data = await gql<{ deleteNode: boolean }>(
      `mutation ($id: ID!) { deleteNode(id: $id) }`,
      { id }
    )
    return data.deleteNode
  }

  async moveNode(
    nodeId: string,
    roadmapId: string,
    position: { x: number; y: number },
    _callerRole: CallerRole
  ): Promise<RoadmapNode> {
    const data = await gql<{ moveNode: RoadmapNode }>(
      `mutation ($nodeId: ID!, $roadmapId: ID!, $positionX: Float!, $positionY: Float!) {
         moveNode(nodeId: $nodeId, roadmapId: $roadmapId, positionX: $positionX, positionY: $positionY) {
           ${NODE_FIELDS}
         }
       }`,
      { nodeId, roadmapId, positionX: position.x, positionY: position.y }
    )
    return data.moveNode
  }

  async saveRoadmap(
    roadmapId: string,
    nodes: RoadmapNode[],
    _callerRole: CallerRole
  ): Promise<boolean> {
    const payload = nodes
      .filter((n) => !n.isDeleted)
      .map((n) => ({
        id: n.id,
        parentId: n.parentId,
        positionX: n.positionX,
        positionY: n.positionY,
      }))
    const data = await gql<{ saveRoadmap: boolean }>(
      `mutation ($roadmapId: ID!, $nodes: [NodeInput!]!) {
         saveRoadmap(roadmapId: $roadmapId, nodes: $nodes)
       }`,
      { roadmapId, nodes: payload }
    )
    return data.saveRoadmap
  }

  // ── Composition (LEGO model) ──────────────────────────────────────────────
  // The backend has no composition/edge tables yet, so this adapter DERIVES an
  // owner's canvas from the existing parentId tree (`allNodes`) and maps writes
  // onto the existing node mutations. Membership = child link; a member sits on
  // exactly one canvas and edges are always owner→child solid. Custom edge
  // kinds and multi-canvas membership persist only once the tables land.

  async getComposition(
    ownerId: string,
    _opts: { callerRole: CallerRole }
  ): Promise<Composition> {
    const nodes = await this.listNodes()
    return deriveCompositionFromNodes(ownerId, nodes)
  }

  async addMember(
    ownerId: string,
    nodeId: string,
    position: { x: number; y: number },
    role: CallerRole
  ): Promise<Composition> {
    const nodes = await this.listNodes()
    const owner = nodes.find((n) => n.id === ownerId)
    const node = nodes.find((n) => n.id === nodeId)
    if (owner && node && node.roadmapId !== owner.roadmapId) {
      // Pull it into the owner's roadmap first so the parent link is valid.
      await this.moveNode(nodeId, owner.roadmapId, position, role)
    }
    await this.updateNode(
      nodeId,
      { parentId: ownerId, positionX: position.x, positionY: position.y },
      role
    )
    return deriveCompositionFromNodes(ownerId, await this.listNodes())
  }

  async removeFromCanvas(
    ownerId: string,
    nodeId: string,
    role: CallerRole
  ): Promise<Composition> {
    const nodes = await this.listNodes()
    const owner = nodes.find((n) => n.id === ownerId)
    const node = nodes.find((n) => n.id === nodeId)
    
    if (owner && node) {
      // Move the node to its own roadmap (self-owned) to remove it from owner's canvas
      // This ensures it won't be derived into owner's composition anymore
      if (node.roadmapId === owner.roadmapId) {
        await this.moveNode(nodeId, nodeId, { x: node.positionX, y: node.positionY }, role)
      } else {
        // Already in different roadmap, just clear parent link
        await this.updateNode(nodeId, { parentId: null }, role)
      }
    }
    
    return deriveCompositionFromNodes(ownerId, await this.listNodes())
  }

  async moveMember(
    _ownerId: string,
    nodeId: string,
    position: { x: number; y: number },
    role: CallerRole
  ): Promise<void> {
    await this.updateNode(
      nodeId,
      { positionX: position.x, positionY: position.y },
      role
    )
  }

  async createBlock(
    input: {
      nodeType: NodeType
      title: string
      description?: string
      ownerId?: string
      positionX: number
      positionY: number
    },
    role: CallerRole
  ): Promise<RoadmapNode> {
    if (input.ownerId) {
      // On a canvas: a child of the owner in the owner's roadmap.
      const nodes = await this.listNodes()
      const owner = nodes.find((n) => n.id === input.ownerId)
      const roadmapId = owner?.roadmapId ?? input.ownerId
      return this.createNode(
        {
          roadmapId,
          parentId: input.ownerId,
          title: input.title,
          nodeType: input.nodeType,
          description: input.description,
          positionX: input.positionX,
          positionY: input.positionY,
        },
        role
      )
    }
    // From the table: a new top-level roadmap = a container + its root node.
    const roadmap = await this.createRoadmap(
      { slug: slugify(input.title), title: input.title },
      role
    )
    return this.createNode(
      {
        roadmapId: roadmap.id,
        parentId: null,
        title: input.title,
        nodeType: input.nodeType,
        description: input.description,
        positionX: input.positionX,
        positionY: input.positionY,
      },
      role
    )
  }

  async deleteBlockPermanent(
    nodeId: string,
    role: CallerRole
  ): Promise<boolean> {
    return this.deleteNode(nodeId, role)
  }

  async addEdge(
    _ownerId: string,
    sourceId: string,
    targetId: string,
    _kind: EdgeKind,
    role: CallerRole
  ): Promise<RoadmapEdge> {
    // Wire = a parent link (backend has no edge kind yet).
    await this.updateNode(targetId, { parentId: sourceId }, role)
    return { id: `edge-${sourceId}-${targetId}`, sourceId, targetId, kind: "solid" }
  }

  async updateEdgeKind(
    _ownerId: string,
    edgeId: string,
    kind: EdgeKind,
    _role: CallerRole
  ): Promise<RoadmapEdge> {
    // No-op: edge kind is not stored on the backend tree yet.
    return { id: edgeId, sourceId: "", targetId: "", kind }
  }

  async removeEdge(
    ownerId: string,
    edgeId: string,
    role: CallerRole
  ): Promise<Composition> {
    const parsed = parseDerivedEdge(edgeId)
    if (parsed) {
      await this.updateNode(parsed.targetId, { parentId: null }, role)
    }
    return deriveCompositionFromNodes(ownerId, await this.listNodes())
  }

  // No-op: backend has no composition table yet; undo/redo only affects UI state.
  async restoreComposition(
    _ownerId: string,
    _comp: Composition,
    _role: CallerRole
  ): Promise<void> {}

  async createArticle(
    input: {
      chapterId: string
      title: string
      articleType: ArticleType
    },
    role: CallerRole
  ): Promise<RoadmapNode> {
    const nodes = await this.listNodes()
    const chapter = nodes.find((n) => n.id === input.chapterId)
    if (!chapter) throw new Error("Chapter not found")
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
      role
    )
  }
}
