# @workspace/db

Prisma schema, generated client, and seed data for the roadmap backend.

## Commands

```bash
cp packages/db/.env.example packages/db/.env
pnpm -F @workspace/db generate:sqlite
pnpm -F @workspace/db db:push:sqlite
pnpm -F @workspace/db seed
```

## Env

`packages/db/.env` is used by Prisma CLI commands in this package. The running
backend reads `apps/svc-api/.env`, so keep both `DATABASE_URL` values aligned.

Dev uses SQLite (`file:./dev.db`) via `prisma/schema.prisma`. Production uses
Postgres/Neon via `prisma/schema.postgres.prisma`.

If local dev starts failing with `DATABASE_URL must start with postgresql://`,
the generated client was built from the Postgres schema. Regenerate the local
client with:

```bash
pnpm -F @workspace/db generate:sqlite
```
