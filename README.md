# tlh222k

Turborepo + pnpm monorepo for the tlh222k roadmap platform. The repo contains
three Next.js frontends, one NestJS roadmap service, and shared packages for UI,
domain logic, database, lint, and TypeScript config.

## Requirements

- Node >= 20
- pnpm 10.33.4, pinned in `packageManager`

## Quick Start

```bash
pnpm install
pnpm -F @workspace/db generate
pnpm -F @workspace/db db:push
pnpm -F @workspace/db seed
pnpm dev
```

Copy env templates before running apps that need real auth/backend data:

```bash
cp apps/web/.env.example          apps/web/.env.local
cp apps/admin/.env.example        apps/admin/.env.local
cp apps/super-admin/.env.example  apps/super-admin/.env.local
cp apps/svc-roadmap/.env.example  apps/svc-roadmap/.env
cp packages/db/.env.example       packages/db/.env
```

See [docs/onboarding/env.md](docs/onboarding/env.md) for key-by-key setup.

## Common Commands

| Command                         | Purpose                             |
| ------------------------------- | ----------------------------------- |
| `pnpm dev`                      | Run all dev tasks through Turborepo |
| `pnpm build`                    | Build the monorepo                  |
| `pnpm lint`                     | Run ESLint                          |
| `pnpm typecheck`                | Run `tsc --noEmit`                  |
| `pnpm format`                   | Run Prettier                        |
| `pnpm --filter web dev`         | Run only the public web app         |
| `pnpm --filter admin dev`       | Run only admin on port 3002         |
| `pnpm --filter super-admin dev` | Run only super-admin on port 3003   |
| `pnpm --filter svc-roadmap dev` | Run the backend on port 3005        |

There is no test runner configured yet. CI is:
`install --frozen-lockfile -> lint -> typecheck -> build`.

## Workspace Map

```text
apps/
  web/          Next.js public frontend and Multi-Zone host, port 3000
  admin/        Next.js roadmap builder/admin child zone, port 3002
  super-admin/  Next.js super-admin child zone, port 3003
  svc-roadmap/  NestJS GraphQL/REST/SSE roadmap backend, port 3005
packages/
  core/         @workspace/core domain logic and feature modules
  db/           @workspace/db Prisma schema, generated client, seed data
  ui/           @workspace/ui shadcn/ui + Tailwind v4 components
  eslint-config/
  typescript-config/
```

`apps/*` may import `packages/*`; packages must not import apps. Package scope is
`@workspace/*`.

## Important Notes

- `packages/ui` and `packages/core/src/roadmap` used to be submodules but are now
  inline. Edit and commit them like normal repo folders.
- Docs under `docs/onboarding/` include both current setup and target-system
  notes. Treat future NestJS/Admin CMS/Prisma architecture docs as roadmap until
  code exists.
- This repo pins Next.js 16.2.6. Before writing Next.js code, read the relevant
  guide under the installed Next docs in `node_modules/.pnpm/.../next/dist/docs/`.

## More Docs

- [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md) for AI-agent rules.
- [docs/onboarding/env.md](docs/onboarding/env.md) for env setup.
- [docs/onboarding/cicd.md](docs/onboarding/cicd.md) for CI/CD.
- [rules/packages.md](rules/packages.md) for package boundaries.
