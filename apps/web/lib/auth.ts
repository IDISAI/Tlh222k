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
  const { userId } = await auth()
  if (userId) return true
  if (
    devAuthRole(
      process.env.NODE_ENV,
      process.env.NEXT_PUBLIC_DEV_AUTH_ROLE,
      process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH_BYPASS
    )
  ) {
    return true
  }
  return false
}

/**
 * Resolve the caller's role from the session token (Req 5.5, A1).
 * Absent / unknown metadata → "viewer".
 */
export async function getRole(): Promise<UserRole> {
  const { userId, sessionClaims } = await auth()
  if (userId) return roleFromClaims(sessionClaims)
  const devRole = devAuthRole(
    process.env.NODE_ENV,
    process.env.NEXT_PUBLIC_DEV_AUTH_ROLE,
    process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH_BYPASS
  )
  if (devRole) return devRole
  return "viewer"
}
