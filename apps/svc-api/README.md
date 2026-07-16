# svc-api

NestJS backend for roadmap data, admin writes, user sync, REST, GraphQL, Swagger,
and server-sent events.

## Run

```bash
cp apps/svc-api/.env.example apps/svc-api/.env
pnpm -F @workspace/db generate:sqlite
pnpm --filter svc-api dev
```

Default port: `3005`.

Endpoints:

- `http://localhost:3005/graphql`
- `http://localhost:3005/api-docs`
- `http://localhost:3005/events`

## Data

The service uses Prisma through `@workspace/db`. For local dev, keep
`apps/svc-api/.env` and `packages/db/.env` on the same `DATABASE_URL`, then
run:

```bash
pnpm -F @workspace/db generate:sqlite
pnpm -F @workspace/db db:push:sqlite
pnpm -F @workspace/db seed
```

Vercel deploys generate the Prisma client from `packages/db/prisma/schema.postgres.prisma`
instead; do not mutate `schema.prisma` to switch providers.

## Env

Copy `.env.example` to `.env`. Server secrets stay in `.env`; there are no
`NEXT_PUBLIC_*` variables in this service. See
[../../docs/onboarding/env.md](../../docs/onboarding/env.md).
