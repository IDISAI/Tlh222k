# apps/svc-api - agent notes

NestJS backend for roadmap APIs. Read the root [CLAUDE.md](../../CLAUDE.md)
first.

- Runs on port 3005 by default.
- Owns GraphQL, REST, Swagger, SSE, Clerk token verification, and Clerk webhook
  user sync.
- Uses `@workspace/db` for Prisma. Do not duplicate Prisma schema or generated
  types inside this app.
- Local dev expects the Prisma client generated from
  `packages/db/prisma/schema.prisma` (`pnpm -F @workspace/db generate:sqlite`).
  Vercel deploys generate from `schema.postgres.prisma`; do not edit
  `schema.prisma` in-place to switch providers.
- Env is `.env.example -> .env`; do not use `NEXT_PUBLIC_*` here.
- Keep CORS origins in `FRONTEND_ORIGINS` aligned with the three frontends.
- API changes should be reflected in `@workspace/core` clients and docs.
