import { auth } from "@clerk/nextjs/server"
import type { UserRole } from "@workspace/core"

declare global {
  // The Clerk session token must expose public metadata as `metadata`.
  // One-time setup — Clerk Dashboard → Sessions → Customize session token:
  //   { "metadata": "{{user.public_metadata}}" }
  interface CustomJwtSessionClaims {
    metadata?: {
      role?: string
    }
    publicMetadata?: {
      role?: string
    }
  }
}

/** True when a Clerk session is present (Viewer or above). */
export async function getIsAuthenticated(): Promise<boolean> {
  const { userId } = await auth()
  return Boolean(userId)
}

/**
 * Resolve the caller's role from `publicMetadata.role` (Req 5.5, A1).
 * Absent / unknown metadata → "viewer".
 */
export async function getRole(): Promise<UserRole> {
  const { sessionClaims } = await auth()
  const rawRole = sessionClaims?.metadata?.role || sessionClaims?.publicMetadata?.role
  const role = typeof rawRole === "string" ? rawRole.toLowerCase().replace(/_/g, "-") : undefined
  return role === "admin" || role === "super-admin" ? (role as UserRole) : "viewer"
}
