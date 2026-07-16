# CLAUDE.md

This file is the canonical guide for AI agents working in this repository.

## Commands

Turborepo + pnpm workspace. Node >= 20, pnpm 10.33.4. `apps/kernel-server` is a
standalone Go module — it is NOT part of the pnpm/turbo workspace.

```bash
pnpm install
pnpm dev          # turbo apps + kernel-server Go binary (via apps/kernel-server/dev.mjs)
pnpm dev:js       # turbo JS apps only (no Go)
pnpm dev:go       # kernel-server Go binary only
pnpm build
pnpm lint
pnpm typecheck
pnpm format

pnpm --filter web dev
pnpm --filter admin dev
pnpm --filter super-admin dev
pnpm --filter svc-api dev
pnpm -F @workspace/db generate
pnpm -F @workspace/db db:push
pnpm -F @workspace/db seed

# kernel-server (Go, from apps/kernel-server/)
go build ./...
go vet ./...
APP_ENV=development DEV_AUTH_ROLE=super-admin SESSION_TICKET_SECRET=development-only-ticket-secret go run ./cmd/server   # listens on :3006
```

There is no test runner configured yet. CI is
`install --frozen-lockfile -> lint -> typecheck -> build`. `lint` is ESLint;
`typecheck` is `tsc --noEmit`. CI does NOT cover the Go kernel-server.

## Architecture

Current committed system:

- `apps/web`: public Next.js frontend and Multi-Zone host, port 3000.
- `apps/admin`: admin/roadmap-builder Next.js child zone, port 3002.
- `apps/super-admin`: super-admin/user-management child zone, port 3003.
- `apps/svc-api`: NestJS backend exposing GraphQL, REST, Swagger, and SSE,
  default port 3005.
- `apps/kernel-server`: **Go** backend for the notebook feature. Standalone Go
  module (not in the pnpm/turbo workspace). Port 3006. Notebook CRUD (filesystem
  store), Clerk-gated auth, CORS, sandbox session tickets. Phase 3: Jupyter
  WebSocket proxy for live kernel execution.
- `packages/core`: shared domain logic, feature-first. Key modules:
  - `src/notebook`: `NotebookService`, viewer, editor, kernel client, exercise,
    runtime, utils. All nbformat parsing lives here — not in Go.
  - `src/roadmap`: roadmap domain logic.
  - `src/navigation`: navigation helpers (incl. `no-script-next-themes`).
- `packages/db`: Prisma schema/client and seed data.
- `packages/ui`: shared shadcn/ui + Tailwind v4 components.
- `packages/eslint-config` and `packages/typescript-config`: shared tooling.

Dependency direction:

```text
apps/*      -> packages/*   OK
packages/*  -> apps/*       never
```

Package scope is `@workspace/*`, not `@vizteck/*`.

## Former Submodules

`packages/ui` and `packages/core/src/roadmap` used to be separate git
submodules. They are now inline in this repo. `.gitmodules` is empty, there are
no gitlinks, and one parent-repo commit covers changes to them. Ignore old docs
that still say to clone or bump submodules.

## Domain Logic

Put shared domain logic in `packages/core`, organized feature-first:

```text
src/<feature>/
  types.ts
  <feature>.service.ts
  hooks/
  components/
  utils/
  index.ts
```

Apps consume packages through `workspace:*`, `transpilePackages`, and tsconfig
paths. `apps/web/lib/core.ts` is the reference for per-app customization.

## Env

There is no shared root app env. Each app/package owns the env file beside it:

```bash
cp apps/web/.env.example          apps/web/.env.local
cp apps/admin/.env.example        apps/admin/.env.local
cp apps/super-admin/.env.example  apps/super-admin/.env.local
cp apps/svc-api/.env.example  apps/svc-api/.env
cp apps/kernel-server/.env.example apps/kernel-server/.env
cp packages/db/.env.example       packages/db/.env
```

Rules:

- Commit only `.env.example`; never commit real `.env` or `.env.local`.
- `NEXT_PUBLIC_*` is browser-visible.
- `NEXT_PUBLIC_SVC_ROADMAP_URL` selects the real backend. If empty,
  `@workspace/core` uses the mock/localStorage roadmap service.
- `NEXT_PUBLIC_KERNEL_SERVER_URL` points web and admin at the Go kernel-server
  (`http://localhost:3006` in dev). If empty, web falls back to committed
  `.ipynb` fixtures and the admin editor uses per-browser localStorage.
- `NEXT_PUBLIC_DEV_AUTH_ROLE` is a dev-only Clerk bypass and is ignored in
  production. The Go kernel-server has a matching `DEV_AUTH_ROLE` env var.

Full guide: [docs/onboarding/env.md](docs/onboarding/env.md).

## Next.js 16.2.6

This repo pins Next.js 16.2.6. Before writing Next code, read the relevant
installed guide under `node_modules/.pnpm/.../node_modules/next/dist/docs/`.
The plain `node_modules/next/dist/docs/` path may not exist with this pnpm
layout.

React 19 warns when a client component renders a `<script>` tag. The apps alias
`next-themes` to `packages/core/src/navigation/no-script-next-themes.tsx` in
their Next config to keep `useTheme()` behavior without the inline script.

## Documentation

Keep `README.md` for human orientation and `AGENTS.md` for AI-agent notes in
committed workspace folders. Do not add those files to generated/cache folders
such as `.git`, `.next`, `.turbo`, `dist`, or `node_modules`.

Docs under `docs/onboarding/` sometimes describe a larger target system. Treat
anything not represented in committed code as roadmap, not current behavior.

## CI/CD

Workflows live in `.github/workflows/`:

- `ci.yml`: lint -> typecheck -> build.
- `deploy-staging.yml`: Vercel preview deploys.
- `release.yml`: Vercel production deploys and GitHub release.

Deploys cover web, admin, and super-admin. Required GitHub secrets include
`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_WEB`,
`VERCEL_PROJECT_ID_ADMIN`, and `VERCEL_PROJECT_ID_SUPER_ADMIN`.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
