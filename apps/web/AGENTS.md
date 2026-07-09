<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js code.

<!-- END:nextjs-agent-rules -->

# apps/web — agent notes

Public frontend + **Multi-Zone host** (port 3000). Read the root [CLAUDE.md](../../CLAUDE.md) first.

- **Host zone:** `next.config.ts` `rewrites()` proxy `/admin` and `/super-admin` to the child apps. Dev → child dev servers (`:3002`/`:3003`); prod → child domains (`ADMIN_URL`/`SUPER_ADMIN_URL`). Child zones build as root apps; this host owns the public prefixes and proxies `/admin-static/*` plus `/super-admin-static/*` for child assets.
- **Auth:** Clerk. `proxy.ts` + `lib/` resolve the role; `RoadmapView` and pages gate on it. `NEXT_PUBLIC_DEV_AUTH_ROLE` bypasses Clerk in dev (ignored when `NODE_ENV=production`).
- **Data:** the roadmap Apollo client lives in `@workspace/core` and calls `${NEXT_PUBLIC_SVC_ROADMAP_URL}/graphql` — the `svc-roadmap` backend must be running for real data.
- **Env:** copy `.env.example` → `.env.local`. Every var is documented there. Never commit `.env.local`.
- **Consuming core/ui:** `workspace:*` dep + `transpilePackages` + tsconfig `paths`. `lib/core.ts` is the per-app customization seam.
- Sentry is wrapped via `withSentryConfig`; a no-op without a DSN, so don't add guards for missing Sentry.
