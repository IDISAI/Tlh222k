import type {
  ArticleType,
  CallerRole,
  Composition,
  CreateFieldInput,
  CreateNodeInput,
  CreateRoadmapInput,
  EdgeKind,
  Field,
  Level,
  NodeStatus,
  NodeType,
  PublishStatus,
  Roadmap,
  RoadmapEdge,
  RoadmapGraph,
  NodeKeyResult,
  RoadmapNode,
  UpdateFieldInput,
  UpdateNodeInput,
  Visibility,
} from "../types"
import { slugify } from "../utils/slugify"
import { gql } from "./client"

// Field selections matching the domain types (childrenCount is server-only).
const ROADMAP_FIELDS = `
  id slug title description thumbnailUrl publishStatus discoverability
  visibility ownerId roleTags dueDate firstPublishedAt archivedAt
  nodeCount learnerCount createdAt updatedAt
`
/** Every column of a discovery label. One place, so the next rename is one edit. */
const FIELD_FIELDS = `id title slug order description imageUrl publishStatus`

const NODE_FIELDS = `
  id roadmapId parentId title slug description nodeType notionPageId
  articleType jupyterUrl positionX positionY order status isDeleted
  linkedRoadmapId publishStatus coverUrl level visibility tags authorId
  keyResults { id text position }
  fields { ${FIELD_FIELDS} }
`
const COMPOSITION_FIELDS = `
  ownerId
  members { nodeId x y isRequired }
  edges { id sourceId targetId kind }
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
    //
    // Labels come down with the blocks rather than through a filtered query:
    // the tab strip switches often and the payload is small, so filtering
    // client-side avoids a round trip per tab click.
    const data = await gql<{
      publicBlocks: {
        id: string
        slug: string
        title: string
        description: string | null
        childrenCount: number
        publishStatus: PublishStatus
        nodeType: "role" | "skill"
        coverUrl: string | null
        level: Level | null
        visibility: Visibility
        updatedAt: string
        createdAt: string | null
        authorId: string | null
        tags: string[]
        learnerCount: number
        fields: Field[]
      }[]
    }>(
      `query {
        publicBlocks {
          id slug title description childrenCount publishStatus
          nodeType coverUrl level visibility updatedAt createdAt authorId
          tags learnerCount
          fields { ${FIELD_FIELDS} }
        }
      }`
    )
    return data.publicBlocks.map((n) => ({
      id: n.id,
      slug: n.slug,
      title: n.title,
      description: n.description,
      thumbnailUrl: n.coverUrl,
      // `publicBlocks` only ever returns published blocks, but the card carries
      // the block's own status rather than a hardcoded one so a later screen
      // that reuses this shape cannot be misled by it.
      publishStatus: n.publishStatus,
      nodeCount: n.childrenCount ?? 0,
      fields: n.fields ?? [],
      blockType: n.nodeType,
      level: n.level,
      visibility: n.visibility,
      updatedAt: n.updatedAt,
      createdAt: n.createdAt ?? undefined,
      authorId: n.authorId ?? undefined,
      // A block's editorial tags ARE the roles the Field list filters by. The
      // container Roadmap's own roleTags column never reaches this screen,
      // because the public list is built from blocks, not containers.
      roleTags: n.tags ?? [],
      learnerCount: n.learnerCount ?? 0,
    }))
  }

  /** Discovery labels for the /roadmaps tab strip. Public — no auth. */
  async listFields(): Promise<Field[]> {
    const data = await gql<{ fields: Field[] }>(
      `query { fields { ${FIELD_FIELDS} } }`
    )
    return data.fields
  }

  /** CMS never falls back to browser-local Field data. */
  async listAdminFields(_callerRole: CallerRole): Promise<Field[]> {
    const data = await gql<{ fields: Field[] }>(
      `query { fields(includeUnpublished: true) { ${FIELD_FIELDS} } }`
    )
    return data.fields
  }

  /** Direct links may resolve a Private Field; Draft remains unreachable. */
  async fieldBySlug(slug: string): Promise<Field | null> {
    const data = await gql<{ field: Field | null }>(
      `query ($slug: String!) { field(slug: $slug) { ${FIELD_FIELDS} } }`,
      { slug }
    )
    return data.field
  }

  /**
   * Find-or-create by title — the server dedupes case-insensitively, so the
   * picker can call this optimistically without checking for an existing label
   * first.
   */
  async createField(
    input: CreateFieldInput | string,
    _callerRole: CallerRole
  ): Promise<Field> {
    const inputValue = typeof input === "string" ? { title: input } : input
    const data = await gql<{ createField: Field }>(
      `mutation ($input: CreateFieldInput!) { createField(input: $input) { ${FIELD_FIELDS} } }`,
      { input: inputValue }
    )
    return data.createField
  }

  /** Retitle in place; every block carrying the label follows. */
  async updateField(
    id: string,
    input: UpdateFieldInput | string,
    _callerRole: CallerRole
  ): Promise<Field> {
    const update = typeof input === "string" ? { title: input } : input
    const data = await gql<{ updateField: Field }>(
      `mutation ($id: ID!, $input: UpdateFieldInput!) {
         updateField(id: $id, input: $input) { ${FIELD_FIELDS} }
       }`,
      { id, input: update }
    )
    return data.updateField
  }

  /** Drops the label everywhere. The blocks themselves survive. */
  async deleteField(id: string, _callerRole: CallerRole): Promise<boolean> {
    const data = await gql<{ deleteField: boolean }>(
      `mutation ($id: ID!) { deleteField(id: $id) }`,
      { id }
    )
    return data.deleteField
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

  /** Ordered roadmap-block memberships for one Field Workspace. */
  async listFieldNodeIds(fieldId: string, _callerRole: CallerRole): Promise<string[]> {
    const data = await gql<{ fieldNodeIds: string[] }>(
      `query ($fieldId: ID!) { fieldNodeIds(fieldId: $fieldId) }`,
      { fieldId }
    )
    return data.fieldNodeIds
  }

  async reorderFieldMembership(
    fieldId: string,
    nodeIds: string[],
    _callerRole: CallerRole
  ): Promise<boolean> {
    const data = await gql<{ reorderFieldMembership: boolean }>(
      `mutation ($fieldId: ID!, $nodeIds: [ID!]!) {
        reorderFieldMembership(fieldId: $fieldId, nodeIds: $nodeIds)
      }`,
      { fieldId, nodeIds }
    )
    return data.reorderFieldMembership
  }

  async publicBlockGraph(id: string): Promise<RoadmapGraph | null> {
    const data = await gql<{ publicBlockGraph: RoadmapGraph | null }>(
      `query ($id: ID!) {
         publicBlockGraph(id: $id) {
           roadmap { ${ROADMAP_FIELDS} }
           nodes { ${NODE_FIELDS} }
           composition {
             ownerId
             members { nodeId x y isRequired }
             edges { id sourceId targetId kind }
           }
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
    input: Partial<CreateRoadmapInput> & { publishStatus?: PublishStatus },
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
    // Key Results have their own mutation — strip them out before the node
    // update, or the server rejects an input field it does not declare.
    const { keyResults, ...nodeInput } = input
    const data = await gql<{ updateNode: RoadmapNode }>(
      `mutation ($id: ID!, $input: UpdateNodeInput!) {
         updateNode(id: $id, input: $input) { ${NODE_FIELDS} }
       }`,
      { id, input: nodeInput }
    )
    if (keyResults) {
      data.updateNode.keyResults = await this.setNodeKeyResults(
        id,
        keyResults,
        _callerRole
      )
    }
    if (input.publishStatus === "PUBLISHED") {
      await gql<{ publishComposition: Composition }>(
        `mutation ($ownerId: ID!) {
          publishComposition(ownerId: $ownerId) {
            ${COMPOSITION_FIELDS}
          }
        }`,
        { ownerId: id }
      )
    }
    return data.updateNode
  }

  /**
   * Replace a node's Key Results with this ordered list. Sending the whole
   * list rather than a diff matches how the editor works — reordering and
   * deleting as much as adding — and cannot strand a row.
   */
  async setNodeKeyResults(
    nodeId: string,
    texts: string[],
    _callerRole: CallerRole
  ): Promise<NodeKeyResult[]> {
    const data = await gql<{ setNodeKeyResults: NodeKeyResult[] }>(
      `mutation ($nodeId: ID!, $texts: [String!]!) {
        setNodeKeyResults(nodeId: $nodeId, texts: $texts) { id text position }
      }`,
      { nodeId, texts }
    )
    return data.setNodeKeyResults
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
    opts: { callerRole: CallerRole }
  ): Promise<Composition> {
    const scope =
      opts.callerRole === "admin" || opts.callerRole === "super-admin"
        ? "DRAFT"
        : "PUBLISHED"
    const data = await gql<{ composition: Composition }>(
      `query ($ownerId: ID!, $scope: CompositionScope!) {
        composition(ownerId: $ownerId, scope: $scope) {
          ${COMPOSITION_FIELDS}
        }
      }`,
      { ownerId, scope }
    )
    return data.composition
  }

  async addMember(
    ownerId: string,
    nodeId: string,
    position: { x: number; y: number },
    role: CallerRole
  ): Promise<Composition> {
    void role
    const data = await gql<{ addCompositionMember: Composition }>(
      `mutation (
        $ownerId: ID!
        $nodeId: ID!
        $positionX: Float!
        $positionY: Float!
      ) {
        addCompositionMember(
          ownerId: $ownerId
          nodeId: $nodeId
          positionX: $positionX
          positionY: $positionY
        ) {
          ${COMPOSITION_FIELDS}
        }
      }`,
      {
        ownerId,
        nodeId,
        positionX: position.x,
        positionY: position.y,
      }
    )
    return data.addCompositionMember
  }

  async removeFromCanvas(
    ownerId: string,
    nodeId: string,
    role: CallerRole
  ): Promise<Composition> {
    void role
    const data = await gql<{ removeCompositionMember: Composition }>(
      `mutation ($ownerId: ID!, $nodeId: ID!) {
        removeCompositionMember(ownerId: $ownerId, nodeId: $nodeId) {
          ${COMPOSITION_FIELDS}
        }
      }`,
      { ownerId, nodeId }
    )
    return data.removeCompositionMember
  }

  async moveMember(
    ownerId: string,
    nodeId: string,
    position: { x: number; y: number },
    role: CallerRole
  ): Promise<void> {
    void role
    await gql<{ moveCompositionMember: boolean }>(
      `mutation (
        $ownerId: ID!
        $nodeId: ID!
        $positionX: Float!
        $positionY: Float!
      ) {
        moveCompositionMember(
          ownerId: $ownerId
          nodeId: $nodeId
          positionX: $positionX
          positionY: $positionY
        )
      }`,
      {
        ownerId,
        nodeId,
        positionX: position.x,
        positionY: position.y,
      }
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
      fieldIds?: string[]
      level?: Level | null
      visibility?: Visibility
      coverUrl?: string | null
      tags?: string[]
    },
    role: CallerRole
  ): Promise<RoadmapNode> {
    if (input.ownerId) {
      const nodes = await this.listNodes()
      const owner = nodes.find((n) => n.id === input.ownerId)
      const roadmapId = owner?.roadmapId ?? input.ownerId
      const created = await this.createNode(
        {
          roadmapId,
          parentId: null,
          title: input.title,
          nodeType: input.nodeType,
          description: input.description,
          positionX: input.positionX,
          positionY: input.positionY,
          fieldIds: input.fieldIds,
          level: input.level,
          visibility: input.visibility,
          coverUrl: input.coverUrl,
          tags: input.tags,
        },
        role
      )
      await this.addMember(
        input.ownerId,
        created.id,
        { x: input.positionX, y: input.positionY },
        role
      )
      return created
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
        fieldIds: input.fieldIds,
        level: input.level,
        visibility: input.visibility,
        coverUrl: input.coverUrl,
        tags: input.tags,
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
    ownerId: string,
    sourceId: string,
    targetId: string,
    kind: EdgeKind,
    role: CallerRole
  ): Promise<RoadmapEdge> {
    void role
    const data = await gql<{ addCompositionEdge: RoadmapEdge }>(
      `mutation (
        $ownerId: ID!
        $sourceId: ID!
        $targetId: ID!
        $kind: EdgeKind!
      ) {
        addCompositionEdge(
          ownerId: $ownerId
          sourceId: $sourceId
          targetId: $targetId
          kind: $kind
        ) {
          id sourceId targetId kind
        }
      }`,
      { ownerId, sourceId, targetId, kind }
    )
    return data.addCompositionEdge
  }

  async updateEdgeKind(
    ownerId: string,
    edgeId: string,
    kind: EdgeKind,
    role: CallerRole
  ): Promise<RoadmapEdge> {
    void role
    const data = await gql<{ updateCompositionEdgeKind: RoadmapEdge }>(
      `mutation ($ownerId: ID!, $edgeId: ID!, $kind: EdgeKind!) {
        updateCompositionEdgeKind(
          ownerId: $ownerId
          edgeId: $edgeId
          kind: $kind
        ) {
          id sourceId targetId kind
        }
      }`,
      { ownerId, edgeId, kind }
    )
    return data.updateCompositionEdgeKind
  }

  async removeEdge(
    ownerId: string,
    edgeId: string,
    role: CallerRole
  ): Promise<Composition> {
    void role
    const data = await gql<{ removeCompositionEdge: Composition }>(
      `mutation ($ownerId: ID!, $edgeId: ID!) {
        removeCompositionEdge(ownerId: $ownerId, edgeId: $edgeId) {
          ${COMPOSITION_FIELDS}
        }
      }`,
      { ownerId, edgeId }
    )
    return data.removeCompositionEdge
  }

  async restoreComposition(
    ownerId: string,
    comp: Composition,
    role: CallerRole
  ): Promise<void> {
    void role
    await gql<{ replaceComposition: Composition }>(
      `mutation (
        $ownerId: ID!
        $members: [CompositionMemberInput!]!
        $edges: [CompositionEdgeInput!]!
      ) {
        replaceComposition(
          ownerId: $ownerId
          members: $members
          edges: $edges
        ) {
          ${COMPOSITION_FIELDS}
        }
      }`,
      {
        ownerId,
        members: comp.members.map((member) => ({
          nodeId: member.nodeId,
          x: member.x,
          y: member.y,
          isRequired: member.isRequired ?? true,
        })),
        edges: comp.edges.map(({ sourceId, targetId, kind }) => ({
          sourceId,
          targetId,
          kind,
        })),
      }
    )
  }

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
