// GraphQL wire types for the roadmap builder (codegen placeholder — Phase 5).
// `NodeType`/`ArticleType`/`NodeStatus` re-exports are intentionally omitted
// here: the canonical definitions already flow from ../types via the barrels.
export type {
  AllNodesQuery,
  CreateNodeMutationVariables,
  CreateRoadmapMutationVariables,
  DeleteNodeMutationVariables,
  DeleteRoadmapMutationVariables,
  GqlRoadmap,
  GqlRoadmapNode,
  RoadmapGraphQuery,
  RoadmapGraphQueryVariables,
  RoadmapsQuery,
  RoadmapsQueryVariables,
  SaveRoadmapMutationVariables,
  Scalars,
  UpdateNodeMutationVariables,
  UpdateRoadmapMutationVariables,
} from "./generated"
