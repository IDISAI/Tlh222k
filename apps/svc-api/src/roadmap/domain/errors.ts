// Domain layer — framework-free. No GraphQL / HTTP / Prisma / Nest imports.
// The interface layer (DomainExceptionFilter) translates these codes into the
// transport error the client expects.

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
 * A business-rule violation raised by the domain. Carries a stable `code`;
 * knows nothing about how it will be surfaced. `DomainExceptionFilter` maps it
 * to a `GraphQLError` (extensions.code) at the boundary, keeping this layer
 * free of any framework dependency (Clean Architecture dependency rule).
 */
export class DomainError extends Error {
  constructor(
    readonly code: RoadmapErrorCode,
    message?: string
  ) {
    super(message ?? code)
    this.name = "DomainError"
  }
}
