import { auth } from "@clerk/nextjs/server"
import { roleFromClaims, type UserRole } from "@workspace/core"

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
  const { userId } = await auth()
  return Boolean(userId)
}

/**
 * Resolve the caller's role from the session token (Req 5.5, A1).
 * Absent / unknown metadata → "viewer".
 */
export async function getRole(): Promise<UserRole> {
  const { sessionClaims } = await auth()
  return roleFromClaims(sessionClaims)
}
