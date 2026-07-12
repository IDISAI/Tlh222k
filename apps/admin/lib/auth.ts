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
  if (devAuthRole() !== null) return true
  const { userId } = await auth()
  return Boolean(userId)
}

/**
 * Resolve the caller's role from the session token (Req 5.5, A1).
 * Absent / unknown metadata → "viewer".
 */
export async function getRole(): Promise<UserRole> {
  const dev = devAuthRole()
  if (dev !== null) return dev
  const { sessionClaims } = await auth()
  return roleFromClaims(sessionClaims)
}

/**
 * Clerk userId, or null under the dev bypass (no Clerk session). Callers that
 * only need an author id should fall back to a placeholder.
 */
export async function getUserId(): Promise<string | null> {
  if (devAuthRole() !== null) return null
  const { userId } = await auth()
  return userId
}
