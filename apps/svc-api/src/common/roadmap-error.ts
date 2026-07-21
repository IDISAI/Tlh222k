import { GraphQLError } from "graphql"

// Single source of truth for the code union lives in the domain layer.
import type { RoadmapErrorCode } from "../roadmap/domain/errors"

export type { RoadmapErrorCode }

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
