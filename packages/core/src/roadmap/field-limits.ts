/** Trim field copy without silently changing what an editor wrote. */
export function normalizeFieldDescription(raw: unknown): string {
  if (typeof raw !== "string") return ""
  return raw.trim()
}
