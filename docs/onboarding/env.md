# Environment Variables (.env)

This is the source of truth for env files in this repo. The short version:
there is no shared root app env. Each app/package owns the env file beside it.

## File Map

| Unit               | Copy from                       | Copy to                       | Loaded by     |
| ------------------ | ------------------------------- | ----------------------------- | ------------- |
| `apps/web`         | `apps/web/.env.example`         | `apps/web/.env.local`         | Next.js       |
| `apps/admin`       | `apps/admin/.env.example`       | `apps/admin/.env.local`       | Next.js       |
| `apps/super-admin` | `apps/super-admin/.env.example` | `apps/super-admin/.env.local` | Next.js       |
| `apps/kernel-server` | documented below               | process/compose environment   | Go            |
| `apps/svc-api`      | `apps/svc-api/.env.example`      | `apps/svc-api/.env`           | NestJS/dotenv |
| `packages/db`      | `packages/db/.env.example`      | `packages/db/.env`            | Prisma CLI    |

```bash
cp apps/web/.env.example          apps/web/.env.local
cp apps/admin/.env.example        apps/admin/.env.local
cp apps/super-admin/.env.example  apps/super-admin/.env.local
cp apps/svc-api/.env.example  apps/svc-api/.env
cp packages/db/.env.example       packages/db/.env
```

## Rules

- Commit only `.env.example` files. Never commit `.env`, `.env.local`, or
  `.env.*.local`.
- `NEXT_PUBLIC_*` is bundled into browser code. Never store secrets there.
- Next.js apps read `.env.local`; `svc-api` and `packages/db` read `.env`.
- If `NEXT_PUBLIC_SVC_API_URL` is empty, `@workspace/core` falls back to the
  local mock/localStorage roadmap service. Set it to `http://localhost:3005` to
  use the real backend. `NEXT_PUBLIC_SVC_ROADMAP_URL` is the legacy name, still
  honored as a fallback after the `svc-roadmap` -> `svc-api` rename.
- `NEXT_PUBLIC_DEV_AUTH_ROLE` is a dev-only Clerk bypass. Comment it out when
  testing real login. It is ignored in production.

## How To Get Keys

| Variable                                            | Used by                              | Where to get it                                                 |
| --------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`                 | web, admin, super-admin              | Clerk Dashboard -> application -> API Keys                      |
| `CLERK_SECRET_KEY`                                  | web, admin, super-admin, svc-api | Clerk Dashboard -> application -> API Keys                      |
| `CLERK_PUBLISHABLE_KEY`                             | svc-api                          | Same publishable key as the frontends                           |
| `CLERK_WEBHOOK_SECRET`                              | svc-api                          | Clerk Dashboard -> Webhooks -> add endpoint -> Signing Secret   |
| `DATABASE_URL`                                      | svc-api, packages/db             | Dev: `file:./dev.db`; prod: Postgres/Neon connection string     |
| `NEXT_PUBLIC_SVC_API_URL`                           | web, admin, super-admin              | Dev backend URL, usually `http://localhost:3005` (legacy: `NEXT_PUBLIC_SVC_ROADMAP_URL`) |
| `NEXT_PUBLIC_HOST_URL`                              | web, admin, super-admin              | Dev web host, usually `http://localhost:3000`                   |
| `ADMIN_URL`                                         | web                                  | Production admin child-zone URL                                 |
| `SUPER_ADMIN_URL`                                   | web                                  | Production super-admin child-zone URL                           |
| `FRONTEND_ORIGINS`                                  | svc-api                              | Comma-separated frontend origins for CORS                       |
| `APP_ENV`                                           | kernel-server                        | `development`, `test`, or `production`                          |
| `CLERK_JWKS_URL`                                    | kernel-server                        | Clerk JWKS HTTPS endpoint                                       |
| `CLERK_ISSUER`                                      | kernel-server                        | Exact expected Clerk JWT `iss` claim                            |
| `CLERK_AUDIENCE`                                    | kernel-server                        | Exact required Clerk JWT `aud` value                            |
| `SESSION_TICKET_SECRET`                             | kernel-server                        | Random 32+ byte server-only secret                              |
| `JUPYTER_BROKER_URL`                                | kernel-server                        | Internal Docker broker base URL                                 |
| `JUPYTER_BROKER_TOKEN`                              | kernel-server, docker-broker         | Random 32+ byte internal bearer secret                          |
| `JUPYTER_MAX_SESSIONS_PER_OWNER`                    | kernel-server                        | Per-user concurrent runtime cap; defaults to `1`                |
| `NEXT_PUBLIC_SENTRY_DSN`                            | web, admin, super-admin              | Sentry project -> Settings -> Client Keys (DSN)                 |
| `SENTRY_DSN`                                        | all server runtimes                  | Same Sentry DSN, or blank to disable                            |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | Next.js builds/CI                    | Sentry project/release settings; token needs `project:releases` |

## Clerk Setup

1. Create or open one Clerk application at https://dashboard.clerk.com.
2. Copy the Publishable Key into all frontend `.env.local` files as
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
3. Copy the Secret Key into all frontend `.env.local` files and
   `apps/svc-api/.env` as `CLERK_SECRET_KEY`.
4. Use the same Clerk application for `web`, `admin`, `super-admin`, and
   `svc-api` so session cookies and user IDs line up.
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

Keep both `packages/db/.env` and `apps/svc-api/.env` on the same
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

`kernel-server` defaults to `APP_ENV=production`. Production startup refuses
`DEV_AUTH_ROLE`, incomplete JWT verification settings, non-HTTPS Clerk URLs,
and ticket secrets shorter than 32 bytes. Local bypass requires explicit
`APP_ENV=development`; `apps/kernel-server/dev.mjs` and compose set it for you.

If a real secret was pasted into chat, screenshots, logs, or a commit, rotate it
in the provider dashboard immediately. Do not try to "hide" it by editing only
the current file.
