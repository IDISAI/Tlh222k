import { auth } from "@clerk/nextjs/server"
import { normalizeRole, roleFromClaims, type UserRole } from "@workspace/core"

declare global {
  // The Clerk session token exposes public metadata as `metadata` (documented)
  // or `publicMetadata`. One-time setup — Clerk Dashboard → Sessions →
  // Customize session token: { "metadata": "{{user.public_metadata}}" }.
  interface CustomJwtSessionClaims {
    metadata?: { role?: string }
    publicMetadata?: { role?: string }
  }
}

// Dev-only auth bypass for headless QA / the localhost-only preview, neither of
// which can open Clerk's external hosted sign-in. Set
// DEV_AUTH_ROLE=viewer|admin|super-admin in .env.local; ignored in production.
const DEV_AUTH_ROLE =
  process.env.NODE_ENV !== "production" ? process.env.NEXT_PUBLIC_DEV_AUTH_ROLE : undefined

/** True when a Clerk session is present (or the dev bypass is on). */
export async function getIsAuthenticated(): Promise<boolean> {
  if (DEV_AUTH_ROLE) return true
  const { userId } = await auth()
  return Boolean(userId)
}

/**
 * Resolve the caller's role from the session token (Req 5.5, A1).
 * Absent / unknown metadata → "viewer".
 */
export async function getRole(): Promise<UserRole> {
  if (DEV_AUTH_ROLE) return normalizeRole(DEV_AUTH_ROLE)
  const { sessionClaims } = await auth()
  return roleFromClaims(sessionClaims)
}
