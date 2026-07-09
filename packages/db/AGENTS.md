# packages/db - agent notes

Prisma package for shared database access.

- Keep schema/client/seed code here; apps should depend on `@workspace/db`
  instead of owning database code.
- Local dev uses SQLite by default. Production uses Postgres/Neon.
- Use `generate:sqlite` / `db:push:sqlite` locally and `generate:postgres` /
  `db:push:postgres` for deploys. Do not mutate `schema.prisma` to switch
  providers.
- If schema changes, update seed data and any `@workspace/core` or
  `svc-roadmap` code that consumes the changed model.
- Do not commit real `.env` or generated local databases.
