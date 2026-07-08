import type {
  CallerRole,
  CreateNodeInput,
  CreateRoadmapInput,
  NodeStatus,
  Roadmap,
  RoadmapGraph,
  RoadmapNode,
  UpdateNodeInput,
} from "../types"
import { gql } from "./client"

// Field selections matching the domain types (childrenCount is server-only).
const ROADMAP_FIELDS = `
  id slug title description thumbnailUrl isPublished nodeCount createdAt updatedAt
`
const NODE_FIELDS = `
  id roadmapId parentId title slug description nodeType notionPageId
  articleType jupyterUrl positionX positionY order status isDeleted
`

/**
 * Backend-backed implementation of the roadmap domain service. Public methods
 * mirror the mock `RoadmapService` 1:1 so every call site is unchanged. Auth is
 * derived from the Clerk token attached by the client, so the `callerRole` /
 * `authenticated` params are accepted for compatibility but not sent.
 */
export class RoadmapApi {
  async list(): Promise<Roadmap[]> {
    const data = await gql<{ roadmaps: Roadmap[] }>(
      `query { roadmaps { ${ROADMAP_FIELDS} } }`
    )
    return data.roadmaps
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
}
