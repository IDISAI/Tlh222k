export const LIFECYCLE_STATUSES = ["DRAFT", "PUBLISHED"] as const
export const DISCOVERABILITIES = ["PUBLIC", "PRIVATE"] as const
export const ROADMAP_VISIBILITIES = ["FREE", "INTERNAL"] as const

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number]
export type Discoverability = (typeof DISCOVERABILITIES)[number]
export type RoadmapVisibility = (typeof ROADMAP_VISIBILITIES)[number]
export type RoadmapAccessRole =
  | "guest"
  | "viewer"
  | "aio"
  | "admin"
  | "super_admin"

export interface RoadmapAccessActor {
  authenticated: boolean
  role: RoadmapAccessRole
}

export interface RoadmapAccessRecord {
  lifecycleStatus: LifecycleStatus | string | null
  discoverability: Discoverability | string | null
  visibility: RoadmapVisibility | string | null
}

function normalizedMember<T extends string>(
  values: readonly T[],
  raw: unknown,
  fallback: T
): T {
  if (typeof raw !== "string") return fallback
  const normalized = raw.trim().toUpperCase()
  return values.includes(normalized as T) ? (normalized as T) : fallback
}

/** Fail closed: unknown lifecycle data is never public. */
export function normalizeLifecycleStatus(raw: unknown): LifecycleStatus {
  return normalizedMember(LIFECYCLE_STATUSES, raw, "DRAFT")
}

/** Fail unlisted: unknown discoverability never leaks into discovery. */
export function normalizeDiscoverability(raw: unknown): Discoverability {
  return normalizedMember(DISCOVERABILITIES, raw, "PRIVATE")
}

/** Existing content stays FREE when the entitlement column is absent. */
export function normalizeRoadmapVisibility(raw: unknown): RoadmapVisibility {
  return normalizedMember(ROADMAP_VISIBILITIES, raw, "FREE")
}

export function canAccessInternal(actor: RoadmapAccessActor): boolean {
  return (
    actor.authenticated &&
    (actor.role === "aio" ||
      actor.role === "admin" ||
      actor.role === "super_admin")
  )
}

export function canManageRoadmaps(actor: RoadmapAccessActor): boolean {
  return (
    actor.authenticated &&
    (actor.role === "admin" || actor.role === "super_admin")
  )
}

/**
 * Direct-link policy. PRIVATE is intentionally absent from this gate: it
 * controls discovery, not whether a named published roadmap can be opened.
 */
export function canOpenRoadmap(
  record: RoadmapAccessRecord,
  actor: RoadmapAccessActor
): boolean {
  if (canManageRoadmaps(actor)) return true
  if (normalizeLifecycleStatus(record.lifecycleStatus) !== "PUBLISHED") {
    return false
  }
  return (
    normalizeRoadmapVisibility(record.visibility) === "FREE" ||
    canAccessInternal(actor)
  )
}

export function canListRoadmap(
  record: RoadmapAccessRecord,
  actor: RoadmapAccessActor
): boolean {
  return (
    normalizeDiscoverability(record.discoverability) === "PUBLIC" &&
    canOpenRoadmap(record, actor)
  )
}

