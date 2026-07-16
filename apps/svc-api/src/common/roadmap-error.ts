import { GraphQLError } from "graphql"

/** Mirrors packages/core RoadmapErrorCode 1:1 (→ GraphQL extensions.code). */
export type RoadmapErrorCode =
  | "PERMISSION_DENIED"
  | "INVALID_NODE_TYPE"
  | "INVALID_HIERARCHY"
  | "LEAF_NODE_CANNOT_HAVE_CHILDREN"
  | "CHILDREN_LIMIT_EXCEEDED"
  | "NOT_FOUND"
  | "TIMEOUT"
  | "INVALID_URL"

/**
 * Throwable that becomes a `GraphQLError` with `extensions.code`, so the
 * frontend `RoadmapService` client can reconstruct its typed error and the
 * toast layer can translate without string-matching.
 */
export class RoadmapError extends GraphQLError {
  constructor(code: RoadmapErrorCode, message?: string) {
    super(message ?? code, { extensions: { code } })
  }
}
