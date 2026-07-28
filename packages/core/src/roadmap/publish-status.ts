/**
 * Whether a Field, roadmap block, notebook or document is shown, hidden, or
 * merely unlisted. One vocabulary for every kind of content, so nobody has to
 * remember which section makes which exception.
 *
 * The domain calls this simply "status". The field is named `publishStatus`
 * because a block already carries a `status` meaning the viewer's own progress
 * through it — two different questions that would otherwise share a word.
 *
 * There is no review state and no archive. Nothing in this system approves
 * content, so a state meaning "awaiting approval" would name an act nobody
 * performs, and a badge nobody can act on is a lie the UI tells.
 */
export const PUBLISH_STATUSES = ["DRAFT", "PUBLISHED", "PRIVATE"] as const

export type PublishStatus = (typeof PUBLISH_STATUSES)[number]

export function isPublishStatus(value: unknown): value is PublishStatus {
  return (
    typeof value === "string" &&
    (PUBLISH_STATUSES as readonly string[]).includes(value)
  )
}

/**
 * Read a status out of whatever the database, an API payload or a form hands
 * over. Anything unrecognised becomes `DRAFT`: an unreadable value must hide
 * content rather than expose it, the same way an unreadable role falls to the
 * least-privileged one.
 */
export function normalizePublishStatus(raw: unknown): PublishStatus {
  if (typeof raw !== "string") return "DRAFT"
  const value = raw.trim().toUpperCase()
  return isPublishStatus(value) ? value : "DRAFT"
}

/**
 * The single visibility rule, in one place. Published is seen; Draft and
 * Private are not. A Private item is reachable by its direct link — that is a
 * question about a request that names it, not about whether it is listed.
 */
export function reachesLearners(status: PublishStatus): boolean {
  return status === "PUBLISHED"
}

/**
 * Read a record's status. Narrowed here rather than trusted — a payload that
 * omitted the field, or a value this system doesn't recognise, falls to
 * DRAFT. Nothing that gates visibility should read the raw field directly, or
 * a gate and a badge built from the same data can end up disagreeing.
 */
export function statusOf(record: {
  publishStatus?: PublishStatus | string | null
}): PublishStatus {
  return normalizePublishStatus(record.publishStatus)
}

/**
 * Backfill translation, and the read side of the Document sync boundary — a
 * Document still carries only a boolean.
 */
export function publishStatusFromLegacy(isPublished: boolean): PublishStatus {
  return isPublished ? "PUBLISHED" : "DRAFT"
}

/**
 * Write-side translation, for the boundary where a roadmap block's publish
 * state syncs with a linked Document — documents keep the boolean this round.
 *
 * Lossy on purpose: `PRIVATE` collapses to `false`, so a round trip through the
 * boolean returns `DRAFT`. Use it to keep the document side in step, never to
 * persist a block's own status.
 */
export function legacyIsPublished(status: PublishStatus): boolean {
  return status === "PUBLISHED"
}
