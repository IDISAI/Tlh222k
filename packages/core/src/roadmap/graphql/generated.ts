/**
 * Hand-authored stand-in for GraphQL Codegen output (Phase 5). Mirrors
 * schema.graphql + operations.graphql so callers can already type against the
 * wire shapes. Once `svc-roadmap` serves the schema, replace this file with
 * real codegen output:
 *
 *   pnpm codegen   # graphql-codegen --config codegen.ts
 *                  # plugins: typescript, typescript-operations,
 *                  #          typescript-react-apollo
 *
 * Do not add runtime code here — the mock `RoadmapService` is the runtime
 * until then.
 */

import type {
  ArticleType,
  NodeStatus,
  NodeType,
  Roadmap,
  RoadmapNode,
} from "../types"

export type Scalars = {
  ID: string
  String: string
  Boolean: boolean
  Int: number
  Float: number
}

// Wire objects re-use the domain types — codegen will emit structurally
// identical shapes with `childrenCount` added on nodes.
export type GqlRoadmap = Roadmap
export type GqlRoadmapNode = RoadmapNode & { childrenCount: number }

export interface CreateRoadmapMutationVariables {
  input: {
    slug: string
    title: string
    description?: string | null
    thumbnailUrl?: string | null
  }
}

export interface UpdateRoadmapMutationVariables {
  id: Scalars["ID"]
  input: {
    title?: string | null
    description?: string | null
    thumbnailUrl?: string | null
    isPublished?: boolean | null
  }
}

export interface DeleteRoadmapMutationVariables {
  id: Scalars["ID"]
}

export interface CreateNodeMutationVariables {
  input: {
    roadmapId: Scalars["ID"]
    parentId?: Scalars["ID"] | null
    title: string
    nodeType: NodeType
    slug?: string | null
    description?: string | null
    notionPageId?: string | null
    articleType?: ArticleType | null
    jupyterUrl?: string | null
    positionX: number
    positionY: number
    order: number
  }
}

export interface UpdateNodeMutationVariables {
  id: Scalars["ID"]
  input: {
    title?: string | null
    description?: string | null
    articleType?: ArticleType | null
    notionPageId?: string | null
    jupyterUrl?: string | null
    positionX?: number | null
    positionY?: number | null
    order?: number | null
    parentId?: Scalars["ID"] | null
  }
}

export interface DeleteNodeMutationVariables {
  id: Scalars["ID"]
}

export interface SaveRoadmapMutationVariables {
  roadmapId: Scalars["ID"]
  nodes: Array<{
    id: Scalars["ID"]
    parentId?: Scalars["ID"] | null
    positionX: number
    positionY: number
  }>
}

export interface RoadmapGraphQueryVariables {
  slug: string
}

export interface RoadmapGraphQuery {
  roadmapGraph: {
    roadmap: GqlRoadmap
    nodes: GqlRoadmapNode[]
  } | null
}

export interface RoadmapsQueryVariables {
  includeUnpublished?: boolean | null
}

export interface RoadmapsQuery {
  roadmaps: GqlRoadmap[]
}

export interface AllNodesQuery {
  allNodes: GqlRoadmapNode[]
}

export type { ArticleType, NodeStatus, NodeType }
