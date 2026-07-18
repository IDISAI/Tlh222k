import { auth } from "@clerk/nextjs/server"
import { devAuthRole, roleFromClaims, type UserRole } from "@workspace/core"

declare global {
  // The Clerk session token exposes public metadata as `metadata` (documented)
  // or `publicMetadata`. One-time setup — Clerk Dashboard → Sessions →
  // Customize session token: { "metadata": "{{user.public_metadata}}" }.
  interface CustomJwtSessionClaims {
    metadata?: { role?: string }
    publicMetadata?: { role?: string }
  }
}

/** True when a Clerk session is present. */
export async function getIsAuthenticated(): Promise<boolean> {
  if (devAuthRole(process.env.NODE_ENV, process.env.NEXT_PUBLIC_DEV_AUTH_ROLE)) {
    return true
  }
  const { userId } = await auth()
  return Boolean(userId)
}

/**
 * Resolve the caller's role from the session token (Req 5.5, A1).
 * Absent / unknown metadata → "viewer".
 */
export async function getRole(): Promise<UserRole> {
  const devRole = devAuthRole(
    process.env.NODE_ENV,
    process.env.NEXT_PUBLIC_DEV_AUTH_ROLE
  )
  if (devRole) return devRole
  const { sessionClaims } = await auth()
  return roleFromClaims(sessionClaims)
}

/**
 * Clerk userId, or null under the dev bypass (no Clerk session). Callers that
 * only need an author id should fall back to a placeholder.
 */
export async function getUserId(): Promise<string | null> {
  if (devAuthRole(process.env.NODE_ENV, process.env.NEXT_PUBLIC_DEV_AUTH_ROLE)) {
    return null
  }
  const { userId } = await auth()
  return userId
}

/**
 * Bearer token for authorizing calls to svc-roadmap. Under the dev bypass we
 * send `dev:<role>` (svc-roadmap accepts it only outside production); otherwise
 * the real short-lived Clerk session token.
 */
export async function getAuthToken(): Promise<string | null> {
  const devRole = devAuthRole(
    process.env.NODE_ENV,
    process.env.NEXT_PUBLIC_DEV_AUTH_ROLE
  )
  if (devRole) return `dev:${devRole}`
  const { getToken } = await auth()
  return getToken()
}
