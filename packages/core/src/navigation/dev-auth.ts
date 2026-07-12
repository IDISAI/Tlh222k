import { normalizeRole } from "./role"
import type { UserRole } from "./types"

/**
 * Dev-only Clerk bypass. When `NEXT_PUBLIC_DEV_AUTH_ROLE` is set and we are not
 * running a production build, every app treats the request as this role and
 * skips Clerk entirely: no `<ClerkProvider>` on the client, no `clerkMiddleware`
 * redirect, no `auth()` call. This lets headless QA and the localhost-only
 * preview run without loading Clerk's external hosted JS
 * (`*.clerk.accounts.dev`), which those sandboxes block.
 *
 * Returns the canonical `UserRole` when the bypass is active, or `null` when it
 * is off (the real Clerk path). Always `null` in production, regardless of env.
 */
export function devAuthRole(): UserRole | null {
  if (process.env.NODE_ENV === "production") return null
  const raw = process.env.NEXT_PUBLIC_DEV_AUTH_ROLE
  if (!raw) return null
  // `user` is the env's friendly alias for the least-privileged real session.
  return raw.trim().toLowerCase() === "user" ? "viewer" : normalizeRole(raw)
}

/** True when the dev Clerk bypass is active — Clerk should be skipped. */
export function isDevAuthBypass(): boolean {
  return devAuthRole() !== null
}
