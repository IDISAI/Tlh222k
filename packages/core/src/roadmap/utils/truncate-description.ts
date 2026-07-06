/**
 * Property 1: render at most `max` (default 160) characters. When truncated,
 * the ellipsis is included in the budget so the result never exceeds `max`.
 */
export function truncateDescription(
  text: string | null | undefined,
  max = 160
): string {
  if (!text) return ""
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max - 1).trimEnd() + "…"
}
