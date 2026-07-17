import type { UserRole } from "./types"

/**
 * Canonicalize a raw role value into a `UserRole`. Accepts the loose forms that
 * show up in the Clerk dashboard (e.g. `SUPER_ADMIN`, `Admin`) and maps any
 * unknown / missing value to the least-privileged `viewer` (Req 5.5, A1).
 */
export function normalizeRole(raw: unknown): UserRole {
  if (typeof raw !== "string") return "viewer"
  const v = raw.trim().toLowerCase().replace(/_/g, "-")
  return v === "admin" || v === "super-admin" ? v : "viewer"
}

/** Resolve the explicit local-development auth bypass. Never active in production. */
export function devAuthRole(
  nodeEnv: string | undefined,
  raw: string | undefined
): UserRole | null {
  if (nodeEnv === "production" || typeof raw !== "string") return null
  const value = raw.trim().toLowerCase().replace(/_/g, "-")
  return value === "viewer" || value === "admin" || value === "super-admin"
    ? value
    : null
}

type RoleClaims =
  | {
      metadata?: { role?: unknown }
      publicMetadata?: { role?: unknown }
    }
  | null
  | undefined

/**
 * Read the caller's role out of Clerk `sessionClaims`, tolerating either claim
 * key. The dashboard's "Customize session token" step may expose public
 * metadata under `metadata` (documented) or `publicMetadata`; support both so
 * the gate doesn't silently fall back to `viewer` on a slightly different
 * setup. Single source of truth shared by every app's proxy + lib/auth.
 */
export function roleFromClaims(claims: RoleClaims): UserRole {
  const raw = claims?.metadata?.role ?? claims?.publicMetadata?.role
  return normalizeRole(raw)
}
