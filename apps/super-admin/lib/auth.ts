import { auth } from "@clerk/nextjs/server"
import { forbidden, redirect } from "next/navigation"
import { devAuthRole, roleFromClaims, type UserRole } from "@workspace/core"

import { SIGN_IN_PATH } from "./paths"

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
  if (devAuthRole(
    process.env.NODE_ENV,
    process.env.NEXT_PUBLIC_DEV_AUTH_ROLE,
    process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH_BYPASS
  )) {
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
    process.env.NEXT_PUBLIC_DEV_AUTH_ROLE,
    process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH_BYPASS
  )
  if (devRole) return devRole
  const { sessionClaims } = await auth()
  return roleFromClaims(sessionClaims)
}

/**
 * Gate for the user-management pages. A guest is sent to sign in, but an
 * authenticated Admin is refused with 403 — sending them to sign-in instead
 * would loop them through a form they have already satisfied and imply the
 * problem is their session rather than their role.
 */
export async function requireSuperAdmin(): Promise<"super-admin"> {
  const role = await getRole()
  if (role === "super-admin") return role
  if (!(await getIsAuthenticated())) redirect(SIGN_IN_PATH)
  forbidden()
}
