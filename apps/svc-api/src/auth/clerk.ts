import { verifyToken } from "@clerk/backend"
import { RoadmapError } from "../common/roadmap-error"

export type CallerRole = "viewer" | "aio" | "admin" | "super-admin"

export interface CurrentUser {
  userId: string
  role: CallerRole
  displayName?: string | null
}

export function displayNameFromClaims(
  claims: Record<string, unknown>
): string | null {
  const username =
    typeof claims.username === "string" ? claims.username.trim() : ""
  if (username) return username
  const name = typeof claims.name === "string" ? claims.name.trim() : ""
  if (name) return name
  const fullName = [claims.first_name, claims.last_name]
    .filter(
      (part): part is string => typeof part === "string" && Boolean(part.trim())
    )
    .join(" ")
    .trim()
  if (fullName) return fullName
  return typeof claims.email === "string" && claims.email.trim()
    ? claims.email.trim()
    : null
}

function normalizeRole(raw: unknown): CallerRole {
  if (typeof raw !== "string") return "viewer"
  const v = raw.trim().toLowerCase().replace(/_/g, "-")
  return v === "aio" || v === "admin" || v === "super-admin" ? v : "viewer"
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

  // Local development devAuthRole bypass
  if (process.env.NODE_ENV !== "production" && token.startsWith("dev:")) {
    const rawRole = token.substring(4)
    const role = normalizeRole(rawRole)
    return {
      userId: `dev-user-${role}`,
      role,
      displayName: role.replace(
        /(^|-)([a-z])/g,
        (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`
      ),
    }
  }

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
    return {
      userId,
      role: normalizeRole(meta?.role),
      displayName: displayNameFromClaims(claims),
    }
  } catch {
    // Expired/invalid token → treat as guest (reads allowed, writes denied).
    return null
  }
}

/** True for admin | super-admin callers. */
export function isAdmin(user: CurrentUser | null): boolean {
  return user?.role === "admin" || user?.role === "super-admin"
}

/** Published Internal blocks stay discoverable, but only this audience may open them. */
export function canAccessInternal(user: CurrentUser | null): boolean {
  return (
    user?.role === "aio" ||
    user?.role === "admin" ||
    user?.role === "super-admin"
  )
}

/** Guard for write mutations (Req 1.4): admin | super-admin only. */
export function assertCanWrite(user: CurrentUser | null): CurrentUser {
  if (!user || !isAdmin(user)) {
    throw new RoadmapError("PERMISSION_DENIED")
  }
  return user
}
