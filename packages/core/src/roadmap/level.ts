/**
 * How demanding a roadmap block is. An editorial judgement made by whoever
 * edits the block — never counted from how many nodes it holds, because a
 * short block can be advanced and a long one gentle.
 *
 * Stored as a canonical key and rendered through `LEVEL_LABELS`, so retitling
 * a level in the UI never means rewriting a column.
 */
export const LEVELS = ["BASIC", "INTERMEDIATE", "ADVANCED"] as const

export type Level = (typeof LEVELS)[number]

/** Ordered easiest first, so a list can iterate `LEVELS` and read naturally. */
export const LEVEL_LABELS: Record<Level, string> = {
  BASIC: "Cơ bản",
  INTERMEDIATE: "Trung cấp",
  ADVANCED: "Nâng cao",
}

export function isLevel(value: unknown): value is Level {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value)
}

/**
 * Read a level out of a form or a column. Returns `null` rather than guessing:
 * a block with no level is a real state meaning "nobody has judged this yet",
 * and defaulting it to Cơ bản would put a judgement in an editor's mouth that
 * they never made.
 */
export function normalizeLevel(raw: unknown): Level | null {
  if (typeof raw !== "string") return null
  const value = raw.trim().toUpperCase()
  return isLevel(value) ? value : null
}
