# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Turborepo + pnpm workspace. Node >= 20, pnpm 10.33.4. `apps/kernel-server` is a standalone Go module — NOT part of the pnpm/turbo workspace.

```bash
pnpm install
pnpm dev          # turbo apps + kernel-server Go binary (via apps/kernel-server/dev.mjs)
pnpm dev:js       # turbo JS apps only (no Go)
pnpm dev:go       # kernel-server Go binary only
pnpm build
pnpm lint         # ESLint across all apps/packages
pnpm typecheck    # tsc --noEmit across all apps/packages
pnpm format

# Per-app
pnpm --filter web dev
pnpm --filter admin dev
pnpm --filter super-admin dev
pnpm --filter svc-api dev

# DB (SQLite locally, Postgres in prod — never mutate schema.prisma to switch)
pnpm -F @workspace/db generate      # regenerate Prisma client (SQLite)
pnpm -F @workspace/db db:push       # push schema changes to local SQLite
pnpm -F @workspace/db seed

# kernel-server (Go, run from apps/kernel-server/)
go build ./...
go vet ./...
APP_ENV=development DEV_AUTH_ROLE=super-admin SESSION_TICKET_SECRET=development-only-ticket-secret go run ./cmd/server
```

No test runner is configured for JS yet. CI pipeline: `install --frozen-lockfile → lint → typecheck → build`. Go kernel-server is NOT covered by CI.

Git hooks (Husky) run on commit/push: `commit-msg` enforces Conventional Commits (`feat|fix|chore|refactor|test|docs|ci: description`), `pre-commit` runs lint+test, `pre-push` runs tests.

## Architecture

| App / Package | Purpose | Port |
|---|---|---|
| `apps/web` | Public Next.js frontend, **Multi-Zone host** | 3000 |
| `apps/admin` | Admin roadmap-builder Next.js child zone | 3002 |
| `apps/super-admin` | User-management Next.js child zone | 3003 |
| `apps/svc-api` | NestJS backend: GraphQL, REST, Swagger, SSE | 3005 |
| `apps/kernel-server` | Go backend: notebook CRUD, Clerk auth, sandbox tickets | 3006 |
| `packages/core` | Shared domain logic, feature-first | — |
| `packages/db` | Prisma schema/client/seed | — |
| `packages/ui` | shadcn/ui + Tailwind v4 components | — |

**Multi-Zone:** `apps/web` is the zone host. Its `next.config.ts` `rewrites()` proxy `/admin/*` → child dev server `:3002` (dev) or `ADMIN_URL` (prod), and `/super-admin/*` → `:3003` / `SUPER_ADMIN_URL`. Child apps build without `basePath`; assets proxy via `/admin-static/*` and `/super-admin-static/*`.

**Dependency rule:** `apps/* → packages/*` only. `packages/*` must never import `apps/*`. Package scope is `@workspace/*`.

Apps consume packages via `workspace:*` dep + `transpilePackages` + tsconfig `paths`. `apps/web/lib/core.ts` is the per-app customization seam.

## packages/core structure

Feature-first under `src/<feature>/`:

```
src/
  roadmap/     types, api, hooks, components, utils, graph, drawer, viewer,
               progress, dashboard, builder, graphql, mock
  notebook/    NotebookService, editor, viewer, kernel, exercise, runtime, utils
  navigation/  role helpers, no-script-next-themes
  notion/      NotionWorkspace, NotionService, hooks, components
```

`packages/core/src/index.ts` re-exports `./roadmap`, `./navigation`, `./notion`, `./notebook`. `packages/core/src/roadmap/index.ts` re-exports all sub-features. Removing/renaming a public export here breaks typecheck across the entire monorepo — update barrel `index.ts` files whenever adding or removing exports.

## Roadmap builder model (LEGO composition — branch hf/roadmap)

Current model as of 2026-07-20. Supersedes `.kiro` specs and any earlier `?node=` tree approach.

- **Every role/skill/chapter node IS a block that owns a canvas.** A block's canvas is its `Composition` (`packages/core/src/roadmap/types.ts`): `{ ownerId, members: [{ nodeId, x, y }], edges: [{ id, source, target, kind }] }`. The owner renders pinned at top; `members` are other blocks placed on it.
- **Membership replaces the parentId tree.** A block can be a member of many canvases (reusable LEGO). `article` is a leaf only — it appears in the right panel of its chapter (`NodeDetailDialog`), never on a canvas.
- **Edges are a new entity** (`EdgeKind = solid | dashed`), independent of parentId. Draw by connecting handles (`addEdge`); right-click → change kind / cut (`removeEdge`). `EdgeContextMenu`.
- **parentId / roadmapId are kept in storage** so the public viewer keeps working. `RoadmapService.getComposition` derives a composition from parentId children when none is stored yet — no migration needed. New blocks self-own (`roadmapId === id`). Composition ops persist immediately; no batch save step.
- **Detail page = one owner block's composition canvas** at `/roadmaps/{nodeId}` (no `?node=`). `BuilderPage` takes `nodeId`; `useCompositionCanvas` + `CompositionCanvas` render it. Drill into a member via its detail-panel "Điều hướng" link → `{base}/{node.id}`; the owner's own panel hides that button (`NodeDetailDialog hideNavigate`).
- **Two deletes:** Canvas remove (`removeFromCanvas`) drops only membership + that block's edges — the block itself and all other edges survive. Sidebar/table delete (`deleteBlockPermanent`) soft-deletes and purges from every composition.
- **Mock-first until `NEXT_PUBLIC_SVC_API_URL` is set.** Apollo `RoadmapApi` has no composition methods yet; `service-selector.ts` casts over the gap, so it only breaks in production when the env var is present.

## Roadmap service selector

`packages/core/src/roadmap/api/service-selector.ts` exports `RoadmapService`. When `NEXT_PUBLIC_SVC_API_URL` (or legacy `NEXT_PUBLIC_SVC_ROADMAP_URL`) is set, it returns `RoadmapApi` (Apollo GraphQL client to `svc-api`). Otherwise it returns `MockRoadmapService` (localStorage). All three frontends consume the same exported `RoadmapService` class; the seam is transparent to callers.

## Database schema (packages/db/prisma/schema.prisma)

Postgres (Neon) in dev and prod. Key models:

- **`Roadmap`** — slug (unique), title, isPublished, owns many `Node`.
- **`Node`** — nodeType (`role | skill | chapter | article`), parentId tree, positionX/Y on canvas, isDeleted soft-delete, linkedRoadmapId (role/skill auto-link), articleType (`notion | jupyter`), progress join.
- **`RoadmapUpdateEvent`** — SSE changelog for real-time viewer refresh.
- **`UserProgress`** — composite PK `(clerkUserId, nodeId)`, status `locked | in_progress | done`.
- **`Document`** — Notion-style hierarchical docs (BlockNote JSON content), slug set only on root docs backing a "notion" article node.

Dev: `DATABASE_URL=file:./dev.db` (SQLite). Prod: Neon Postgres. Use `generate:sqlite` / `db:push:sqlite` locally; `generate:postgres` / `db:push:postgres` for Vercel deploys. Never mutate `schema.prisma` in place to switch providers — use the two separate schema files.

## Auth

All three frontends use **Clerk** with a shared instance (same session cookie). `proxy.ts` + `lib/` resolve the user role before rendering. `NEXT_PUBLIC_DEV_AUTH_ROLE` bypasses Clerk in dev — never set in production. `svc-api` verifies Clerk JWT on every request; kernel-server uses RS256 JWKS verification.

React 19 warns when a client component renders `<script>`. The apps alias `next-themes` to `packages/core/src/navigation/no-script-next-themes.tsx` in their Next config to suppress the warning. Do not use `next-themes` directly.

## Env

No shared root env. Each app owns its own:

```bash
cp apps/web/.env.example          apps/web/.env.local
cp apps/admin/.env.example        apps/admin/.env.local
cp apps/super-admin/.env.example  apps/super-admin/.env.local
cp apps/svc-api/.env.example      apps/svc-api/.env
cp packages/db/.env.example       packages/db/.env
```

Key variables:

| Variable | Effect |
|---|---|
| `NEXT_PUBLIC_SVC_API_URL` | Enables real `svc-api` GraphQL backend. Empty = mock/localStorage. Legacy name `NEXT_PUBLIC_SVC_ROADMAP_URL` honored. |
| `NEXT_PUBLIC_KERNEL_SERVER_URL` | Points frontends at Go kernel-server. Empty = web uses committed `.ipynb` fixtures. |
| `NEXT_PUBLIC_DEV_AUTH_ROLE` | Dev-only Clerk bypass (`admin`, `super-admin`). Ignored in production. |
| `DATABASE_URL` / `DIRECT_URL` | Postgres connection (pooled / direct). Shared between `svc-api` and `packages/db`. |
| `FRONTEND_ORIGINS` | CORS allow-list for `svc-api` (comma-separated). |

Full variable reference: [docs/onboarding/env.md](docs/onboarding/env.md).

## CI/CD

Workflows in `.github/workflows/`:

- `ci.yml`: lint → typecheck → build.
- `deploy-staging.yml`: Vercel preview deploys.
- `release.yml`: Vercel production deploys + GitHub release.

Covers `web`, `admin`, `super-admin`. GitHub secrets needed: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_WEB`, `VERCEL_PROJECT_ID_ADMIN`, `VERCEL_PROJECT_ID_SUPER_ADMIN`.

## Notes for AI agents

- **Next.js 16.2.6 is pinned** — APIs may differ from training data. Read `node_modules/next/dist/docs/` before writing Next.js code.
- **No submodules.** `packages/ui` and `packages/core/src/roadmap` were submodules; they are now inline. Ignore docs that say to clone or bump submodules.
- **Docs under `docs/onboarding/` may describe a larger target system.** Treat anything not in committed code as roadmap, not current behavior.
- **kernel-server is stdlib-only Go.** Do not add third-party Go dependencies. All nbformat parsing lives in TS `NotebookService`; do not add a Go parser.
- **Prisma dual-schema setup.** `schema.prisma` = Postgres (production). Local dev uses the same schema with SQLite via `DATABASE_URL=file:./dev.db`. `generate:postgres` is for Vercel deploy — running it locally breaks `:3005`.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool.

| Request type | Skill |
|---|---|
| Product ideas / brainstorming | `/office-hours` |
| Strategy / scope | `/plan-ceo-review` |
| Architecture | `/plan-eng-review` |
| Design system / plan review | `/design-consultation` or `/plan-design-review` |
| Full review pipeline | `/autoplan` |
| Bugs / errors | `/investigate` |
| QA / testing site behavior | `/qa` or `/qa-only` |
| Code review / diff check | `/review` |
| Visual polish | `/design-review` |
| Ship / deploy / PR | `/ship` or `/land-and-deploy` |
| Save progress | `/context-save` |
| Resume context | `/context-restore` |
| Author a backlog-ready spec | `/spec` |

## Agent skills

Issues live in GitHub Issues on `IDISAI/Tlh222k`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

Triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

Domain docs: one `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.
