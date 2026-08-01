import { auth } from "@clerk/nextjs/server"
import { forbidden } from "next/navigation"
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

/** The two roles that may reach any page in this zone. */
export type CmsRole = Extract<UserRole, "admin" | "super-admin">

/**
 * The CMS gate every page in this zone runs first. Answers 403 rather than
 * redirecting, because a redirect to a page that reads "403" is still a 200
 * and hides the refusal from anything that is not a human with a browser.
 * Returns the narrowed role so callers can keep passing it straight down.
 */
export async function requireCmsRole(): Promise<CmsRole> {
  const role = await getRole()
  if (role !== "admin" && role !== "super-admin") forbidden()
  return role
}

/**
 * Clerk userId, or null under the dev bypass (no Clerk session). Callers that
 * only need an author id should fall back to a placeholder.
 */
export async function getUserId(): Promise<string | null> {
  const { userId } = await auth()
  if (userId) return userId
  if (
    devAuthRole(
      process.env.NODE_ENV,
      process.env.NEXT_PUBLIC_DEV_AUTH_ROLE,
      process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH_BYPASS
    )
  ) {
    return null
  }
  return null
}

/**
 * Bearer token for authorizing calls to svc-roadmap. Under the dev bypass we
 * send `dev:<role>` (svc-roadmap accepts it only outside production); otherwise
 * the real short-lived Clerk session token.
 */
export async function getAuthToken(): Promise<string | null> {
  const { getToken } = await auth()
  const token = await getToken()
  if (token) return token
  const devRole = devAuthRole(
    process.env.NODE_ENV,
    process.env.NEXT_PUBLIC_DEV_AUTH_ROLE,
    process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH_BYPASS
  )
  if (devRole) return `dev:${devRole}`
  return null
}
