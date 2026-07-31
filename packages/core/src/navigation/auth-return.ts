/**
 * Where a learner should land after Clerk sends them back.
 *
 * The access contract asks for more than "the same page": the canvas node they
 * had open and the spot they had scrolled the canvas to are part of where they
 * were. None of that survives a redirect on its own, because it lives in React
 * state — so the viewer mirrors it into the query string, and this module is
 * the one place that knows the parameter names.
 */

export const NODE_PARAM = "node"
export const VIEWPORT_PARAM = "at"

export interface CanvasViewport {
  x: number
  y: number
  zoom: number
}

/** Serialize a viewport compactly enough to sit in a shareable URL. */
export function encodeViewport(viewport: CanvasViewport): string {
  const round = (value: number) => Math.round(value * 100) / 100
  return `${round(viewport.x)},${round(viewport.y)},${round(viewport.zoom)}`
}

/**
 * Parse `x,y,zoom`. Returns null for anything malformed rather than a partly
 * filled viewport, because half-restoring a camera puts the learner somewhere
 * they never were, which is worse than leaving it at the default.
 */
export function decodeViewport(raw: string | null): CanvasViewport | null {
  if (!raw) return null
  const parts = raw.split(",")
  if (parts.length !== 3) return null
  const [x, y, zoom] = parts.map(Number)
  if (
    x === undefined ||
    y === undefined ||
    zoom === undefined ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(zoom) ||
    zoom <= 0
  ) {
    return null
  }
  return { x, y, zoom }
}

/**
 * Build the `redirect_url` Clerk should honour. Kept relative on purpose: an
 * absolute URL here is an open-redirect waiting to happen, since the value
 * reaches Clerk through a query parameter anyone can rewrite.
 */
export function authReturnUrl(pathname: string, search?: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`
  if (!search) return path
  const query = search.startsWith("?") ? search : `?${search}`
  return query === "?" ? path : `${path}${query}`
}

/**
 * Accept a return target only when it points back into this app. Clerk hands
 * the value back from the URL, so a caller could otherwise be bounced to
 * another origin — `//evil.example` and `https://evil.example` both parse as
 * absolute, and a backslash is normalised to a slash by several browsers.
 */
export function safeReturnUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  const value = raw.replace(/\\/g, "/")
  if (!value.startsWith("/") || value.startsWith("//")) return null
  return value
}
