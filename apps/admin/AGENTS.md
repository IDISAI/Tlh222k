<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js code.

<!-- END:nextjs-agent-rules -->

# apps/admin — agent notes

Admin frontend + **roadmap builder** (child zone, port 3002). Read the root [CLAUDE.md](../../CLAUDE.md) first. Config mirrors `apps/web`.

- **Child zone:** reached through the web host at `/admin`, but this app builds without Next `basePath` so Clerk `proxy.ts` runs before `auth()` on Vercel. Production public links use `/admin/*`; the web host strips that prefix before forwarding to this root-built child app. Assets use `/admin-static/*`.
- **Builder:** CRUD pages under `app/roadmaps` / `app/roadmap` write to `svc-roadmap` via the GraphQL client in `@workspace/core`. Denied access renders `app/403`.
- **Auth:** Clerk + `proxy.ts` role resolution; `NEXT_PUBLIC_DEV_AUTH_ROLE` bypasses Clerk in dev.
- **Env:** `.env.example` → `.env.local`. Legacy Notion/Liveblocks/Auth.js vars were removed — don't reintroduce them.
- Same Clerk instance as web/super-admin (shared session cookie).
