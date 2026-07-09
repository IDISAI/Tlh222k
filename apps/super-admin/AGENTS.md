<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

Read the relevant installed Next.js 16.2.6 docs before editing Next code.

<!-- END:nextjs-agent-rules -->

# apps/super-admin - agent notes

Super-admin frontend and user-management child zone, port 3003. Read the root
[CLAUDE.md](../../CLAUDE.md) first.

- Reached through the web host at `/super-admin` in production. In dev it runs at
  `http://localhost:3003` without the `/super-admin` prefix.
- Build without Next `basePath` so Clerk `proxy.ts` runs before `auth()` on
  Vercel. Production public links use `/super-admin/*`; the web host strips that
  prefix before forwarding to this root-built child app. Assets use
  `/super-admin-static/*`.
- Auth uses Clerk plus `proxy.ts`. `NEXT_PUBLIC_DEV_AUTH_ROLE` bypasses Clerk in
  local dev only.
- User and roadmap data come from `svc-roadmap` through the GraphQL client in
  `@workspace/core`.
- Env is `.env.example -> .env.local`. Use the same Clerk application as web,
  admin, and svc-roadmap.
