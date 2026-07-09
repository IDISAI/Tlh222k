# Environment Variables (.env)

This is the source of truth for env files in this repo. The short version:
there is no shared root app env. Each app/package owns the env file beside it.

## File Map

| Unit               | Copy from                       | Copy to                       | Loaded by     |
| ------------------ | ------------------------------- | ----------------------------- | ------------- |
| `apps/web`         | `apps/web/.env.example`         | `apps/web/.env.local`         | Next.js       |
| `apps/admin`       | `apps/admin/.env.example`       | `apps/admin/.env.local`       | Next.js       |
| `apps/super-admin` | `apps/super-admin/.env.example` | `apps/super-admin/.env.local` | Next.js       |
| `apps/svc-roadmap` | `apps/svc-roadmap/.env.example` | `apps/svc-roadmap/.env`       | NestJS/dotenv |
| `packages/db`      | `packages/db/.env.example`      | `packages/db/.env`            | Prisma CLI    |

```bash
cp apps/web/.env.example          apps/web/.env.local
cp apps/admin/.env.example        apps/admin/.env.local
cp apps/super-admin/.env.example  apps/super-admin/.env.local
cp apps/svc-roadmap/.env.example  apps/svc-roadmap/.env
cp packages/db/.env.example       packages/db/.env
```

## Rules

- Commit only `.env.example` files. Never commit `.env`, `.env.local`, or
  `.env.*.local`.
- `NEXT_PUBLIC_*` is bundled into browser code. Never store secrets there.
- Next.js apps read `.env.local`; `svc-roadmap` and `packages/db` read `.env`.
- If `NEXT_PUBLIC_SVC_ROADMAP_URL` is empty, `@workspace/core` falls back to the
  local mock/localStorage roadmap service. Set it to `http://localhost:3005` to
  use the real backend.
- `NEXT_PUBLIC_DEV_AUTH_ROLE` is a dev-only Clerk bypass. Comment it out when
  testing real login. It is ignored in production.

## How To Get Keys

| Variable                                            | Used by                              | Where to get it                                                 |
| --------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`                 | web, admin, super-admin              | Clerk Dashboard -> application -> API Keys                      |
| `CLERK_SECRET_KEY`                                  | web, admin, super-admin, svc-roadmap | Clerk Dashboard -> application -> API Keys                      |
| `CLERK_PUBLISHABLE_KEY`                             | svc-roadmap                          | Same publishable key as the frontends                           |
| `CLERK_WEBHOOK_SECRET`                              | svc-roadmap                          | Clerk Dashboard -> Webhooks -> add endpoint -> Signing Secret   |
| `DATABASE_URL`                                      | svc-roadmap, packages/db             | Dev: `file:./dev.db`; prod: Postgres/Neon connection string     |
| `NEXT_PUBLIC_SVC_ROADMAP_URL`                       | web, admin, super-admin              | Dev backend URL, usually `http://localhost:3005`                |
| `NEXT_PUBLIC_HOST_URL`                              | web, admin, super-admin              | Dev web host, usually `http://localhost:3000`                   |
| `ADMIN_URL`                                         | web                                  | Production admin child-zone URL                                 |
| `SUPER_ADMIN_URL`                                   | web                                  | Production super-admin child-zone URL                           |
| `FRONTEND_ORIGINS`                                  | svc-roadmap                          | Comma-separated frontend origins for CORS                       |
| `NEXT_PUBLIC_SENTRY_DSN`                            | web, admin, super-admin              | Sentry project -> Settings -> Client Keys (DSN)                 |
| `SENTRY_DSN`                                        | all server runtimes                  | Same Sentry DSN, or blank to disable                            |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | Next.js builds/CI                    | Sentry project/release settings; token needs `project:releases` |

## Clerk Setup

1. Create or open one Clerk application at https://dashboard.clerk.com.
2. Copy the Publishable Key into all frontend `.env.local` files as
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
3. Copy the Secret Key into all frontend `.env.local` files and
   `apps/svc-roadmap/.env` as `CLERK_SECRET_KEY`.
4. Use the same Clerk application for `web`, `admin`, `super-admin`, and
   `svc-roadmap` so session cookies and user IDs line up.
5. For user sync, add a webhook endpoint. Local development endpoint:
   `http://localhost:3005/webhooks/clerk`. Copy the Signing Secret into
   `CLERK_WEBHOOK_SECRET`.

## Database Setup

Dev uses SQLite:

```bash
pnpm -F @workspace/db generate
pnpm -F @workspace/db db:push
pnpm -F @workspace/db seed
```

Keep both `packages/db/.env` and `apps/svc-roadmap/.env` on the same
`DATABASE_URL`. For production, use Postgres/Neon and the Postgres Prisma schema.

## Vercel

Do not upload local `.env` files. Add variables in each Vercel project under
Settings -> Environment Variables, or use:

```bash
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env pull apps/web/.env.local
```

GitHub Actions deploy secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`,
`VERCEL_PROJECT_ID_WEB`, `VERCEL_PROJECT_ID_ADMIN`,
`VERCEL_PROJECT_ID_SUPER_ADMIN`) are CI secrets, not app `.env` variables.

## Security

If a real secret was pasted into chat, screenshots, logs, or a commit, rotate it
in the provider dashboard immediately. Do not try to "hide" it by editing only
the current file.
