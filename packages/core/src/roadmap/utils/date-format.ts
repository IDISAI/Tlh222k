const VI_DATE_FORMAT = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

const VI_RTF = new Intl.RelativeTimeFormat("vi", { numeric: "auto" })

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

/**
 * Format an ISO 8601 date string as `dd/MM/yyyy` (Vietnamese locale).
 * Returns `—` for null/undefined/empty/invalid input.
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return "—"
  return VI_DATE_FORMAT.format(d)
}

/**
 * Relative time (Vietnamese) when the date is within the last 24h, else
 * `formatDate`. Thresholds: <60s "vừa xong", <60m "N phút trước", <24h "N giờ
 * trước", ≥24h → dd/MM/yyyy. Future timestamps fall back to `formatDate`.
 * Returns `—` for null/undefined/empty/invalid input. `now` is injectable for
 * deterministic tests.
 */
export function formatRelativeTime(
  dateStr: string | null | undefined,
  now: Date = new Date()
): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return "—"
  const deltaMs = now.getTime() - d.getTime()
  if (deltaMs < 0) return formatDate(dateStr)
  if (deltaMs < DAY_MS) {
    if (deltaMs < MINUTE_MS) return VI_RTF.format(0, "second") // "vừa xong"
    if (deltaMs < HOUR_MS) {
      return VI_RTF.format(-Math.floor(deltaMs / MINUTE_MS), "minute")
    }
    return VI_RTF.format(-Math.floor(deltaMs / HOUR_MS), "hour")
  }
  return formatDate(dateStr)
}
