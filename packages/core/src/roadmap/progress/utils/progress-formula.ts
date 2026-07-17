/**
 * Property 11 / D1: completion percentage = floor(done / total * 100), always
 * within [0, 100]. Guards total === 0.
 */
export function progressPercent(doneCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0
  const pct = Math.floor((doneCount / totalCount) * 100)
  return Math.min(100, Math.max(0, pct))
}
