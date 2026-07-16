// Shared CORS origin policy for both bootstraps (main.ts local, serverless.ts
// Vercel). Kept in one place so the allowlist rule can't drift between the two.

// Vercel preview deploys get a per-commit hostname a static allowlist can't
// enumerate (web previews are tlh222k-<hash>-idis.vercel.app; admin/super-admin
// keep the app name). Anchor on the team suffix `-idis.vercel.app` so ONLY
// deploys under this Vercel team match — a bare `tlh222k-` prefix would let
// anyone spoof by naming their own project tlh222k-*.
export const PREVIEW_ORIGIN = /^https:\/\/tlh222k-[\w-]+-idis\.vercel\.app$/

/**
 * True when `origin` may call the API. No Origin header (curl / server-to-server)
 * is always allowed. `allowAllWhenEmpty` mirrors serverless.ts's behavior of
 * allowing everything when FRONTEND_ORIGINS is unset (dev/preview convenience).
 */
export function isAllowedOrigin(
  origin: string | undefined,
  allowlist: readonly string[],
  opts: { allowAllWhenEmpty?: boolean } = {}
): boolean {
  if (!origin) return true
  if (opts.allowAllWhenEmpty && allowlist.length === 0) return true
  return allowlist.includes(origin) || PREVIEW_ORIGIN.test(origin)
}
