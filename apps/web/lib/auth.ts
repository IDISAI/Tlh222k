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
  // Dev bypass: no Clerk, treat the request as signed in.
  if (devAuthRole() !== null) return true
  const { userId } = await auth()
  return Boolean(userId)
}

/**
 * Resolve the caller's role from the session token (Req 5.5, A1).
 * Absent / unknown metadata → "viewer".
 */
export async function getRole(): Promise<UserRole> {
  // Dev bypass: skip Clerk's auth() (clerkMiddleware isn't running) and use
  // the role from NEXT_PUBLIC_DEV_AUTH_ROLE.
  const dev = devAuthRole()
  if (dev !== null) return dev
  const { sessionClaims } = await auth()
  return roleFromClaims(sessionClaims)
}
