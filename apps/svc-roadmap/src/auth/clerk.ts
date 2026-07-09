import { verifyToken } from "@clerk/backend"
import { RoadmapError } from "../common/roadmap-error"

export type CallerRole = "viewer" | "admin" | "super-admin"

export interface CurrentUser {
  userId: string
  role: CallerRole
}

function normalizeRole(raw: unknown): CallerRole {
  if (typeof raw !== "string") return "viewer"
  const v = raw.trim().toLowerCase().replace(/_/g, "-")
  return v === "admin" || v === "super-admin" ? v : "viewer"
}

/**
 * Resolve the caller from an `Authorization: Bearer <clerk session token>`
 * header. Returns null for guests (no/invalid token) so public reads still
 * work; role comes from Clerk publicMetadata (metadata|publicMetadata claim).
 */
export async function resolveUser(
  authorization: string | undefined
): Promise<CurrentUser | null> {
  const token = authorization?.replace(/^Bearer\s+/i, "").trim()
  if (!token) return null

  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) return null

  try {
    const claims = (await verifyToken(token, { secretKey })) as Record<
      string,
      unknown
    >
    const userId = typeof claims.sub === "string" ? claims.sub : null
    if (!userId) return null
    const meta = (claims.metadata ?? claims.publicMetadata) as
      | { role?: unknown }
      | undefined
    return { userId, role: normalizeRole(meta?.role) }
  } catch {
    // Expired/invalid token → treat as guest (reads allowed, writes denied).
    return null
  }
}

/** Guard for write mutations (Req 1.4): admin | super-admin only. */
export function assertCanWrite(user: CurrentUser | null): CurrentUser {
  if (!user || (user.role !== "admin" && user.role !== "super-admin")) {
    throw new RoadmapError("PERMISSION_DENIED")
  }
  return user
}
