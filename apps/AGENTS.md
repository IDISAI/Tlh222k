# apps - agent notes

This folder contains runtime apps. Read the root [CLAUDE.md](../CLAUDE.md)
before editing any app.

- Next.js apps are `web`, `admin`, and `super-admin`. Read each app's local
  `AGENTS.md` before changing routes, layouts, config, auth, or env.
- Backend app is `svc-api`. It owns GraphQL/REST/SSE APIs and talks to
  `@workspace/db`.
- App env files are local to each app. Next.js apps use `.env.local`;
  `svc-api` uses `.env`.
- Apps may import `packages/*`; packages must not import apps.
- Do not add app-level code to this grouping folder.
