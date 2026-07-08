# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Turborepo + pnpm workspace. Node ≥20, pnpm 10.33.4 (pinned via `packageManager`).

```bash
pnpm install                      # install all workspaces
pnpm dev                          # turbo dev (persistent, all apps)
pnpm build                        # turbo build
pnpm lint                         # eslint across packages (real lint, not typecheck)
pnpm typecheck                    # tsc --noEmit across packages (separate task from lint)
pnpm format                       # prettier --write

pnpm --filter <name> <script>     # run one package, e.g. pnpm --filter web build
pnpm --filter web dev             # run only the web app
```

There is **no test runner configured yet** — `pnpm test` does not exist. The CI chain is `install --frozen-lockfile → lint → typecheck → build`. Run that locally before pushing.

Note: [docs/onboarding/cicd.md](docs/onboarding/cicd.md) says "`pnpm lint` = TypeScript type check" — that is outdated. `lint` and `typecheck` are distinct turbo tasks here.

## Former submodules (now inlined)

`packages/ui` and `packages/core/src/roadmap` used to be separate git submodules (repos `IDISAI/ui`, `IDISAI/roadmap`). They have since been **inlined into this repo** (commit `chore: remove submodules from .gitmodules file`) — `.gitmodules` is empty, there are no gitlinks, and a single commit here covers changes to them. Edit them like any normal directory; `git clone --recurse-submodules` is no longer needed.

- Each inlined dir still carries its own `AGENTS.md`/`README.md` from when it was standalone — read `packages/core/src/roadmap/AGENTS.md` before touching the roadmap graph/builder.
- CI workflows still pass `submodules: recursive` + `SUBMODULE_PAT`, but these are now **no-ops** (nothing to fetch). [docs/onboarding/submodules.md](docs/onboarding/submodules.md) is obsolete.

## Architecture

**What exists today:** three Next.js frontends — `apps/web` (default port 3000), `apps/admin` (3002), `apps/super-admin` (3003) — plus shared `packages/*`. All three mount `RoadmapView` from `@workspace/core` and gate access with role resolution from `@workspace/core/navigation/role`; `admin`/`super-admin` add a roadmap **builder** (admin CRUD pages under `apps/admin/app/roadmaps`). The former `notion` core feature has been removed. `apps/svc-notion`, `apps/svc-roadmap`, and `packages/db` currently exist only as untracked stubs (a `dist/` folder, no committed source) — they are not wired in yet. The docs under [docs/onboarding/](docs/onboarding/) describe a larger **target** system (NestJS `api-gateway`, Prisma `packages/db`, Playwright e2e) that is **not built yet** — treat those as roadmap, not current state.

**Dependency direction** (enforced by convention, see [rules/packages.md](rules/packages.md)):
```
apps/*  →  packages/*        ✓
packages/* → apps/*          ✗ never
```

**`packages/core` (`@workspace/core`)** — all domain logic lives here, organized feature-first:
```
src/<feature>/            e.g. roadmap/, navigation/, notebook/
  <sub-feature>/          e.g. roadmap/{graph,builder}, notebook/{viewer,utils}
```
Every feature/sub-feature follows the same shape: `types.ts`, `<slug>.service.ts`, `hooks/`, `components/`, `utils/`, and an `index.ts` barrel that re-exports them (parent features also re-export their sub-features up to `src/index.ts`). `core` uses `moduleResolution: Bundler` so barrels can `export *` without file extensions. Subpath imports work too (e.g. `@workspace/core/navigation/role`).

The `src/index.ts` barrel currently re-exports `roadmap` + `navigation`. The `notebook` feature (Jupyter/Kaggle `.ipynb` viewer — `nbformat` parsing, ANSI + syntax highlight, markdown cells) is being built on branch `feat/jupyter-notebook-kaggle` and is **not wired into the barrel yet**.

**Consuming a package from an app:** add `"@workspace/<pkg>": "workspace:*"` to the app's deps, add it to `transpilePackages` in `next.config.ts`, and map it under `paths` in the app's `tsconfig.json` (see `apps/web`). `apps/web/lib/core.ts` is the reference example of importing core and customizing per-app.

**Package naming is `@workspace/*`** (e.g. `@workspace/ui`, `@workspace/core`). Some docs/rules mention `@vizteck/*` — that is outdated; the real scope is `@workspace`.

## Next.js version warning

This repo pins a modified Next.js (see [AGENTS.md](AGENTS.md)) with breaking changes vs. common knowledge. Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`.

## CI/CD

Three workflows in `.github/workflows/` (see [docs/onboarding/cicd.md](docs/onboarding/cicd.md)):
- `ci.yml` — PRs + push to `main`/`develop`/`release/**`: lint → typecheck → build.
- `deploy-staging.yml` — push `develop`/`release/**`: Vercel preview (web).
- `release.yml` — tag `v*`: Vercel production (web) + GitHub Release.

Deploys cover **web + admin + super-admin** (matrix job per app) and require GitHub secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_WEB`, `VERCEL_PROJECT_ID_ADMIN`, `VERCEL_PROJECT_ID_SUPER_ADMIN` (note underscore — hyphens are invalid in secret names, so the matrix maps `super-admin` → `SUPER_ADMIN`); each Vercel project's Root Directory = the app dir.

App env vars (`.env.local`, Vercel dashboard) are separate from CI secrets — see [docs/onboarding/env.md](docs/onboarding/env.md). Current app code consumes none yet.

Every workflow still checks out with `submodules: recursive` and `token: ${{ secrets.SUBMODULE_PAT || github.token }}`, but since `packages/ui` and the roadmap feature are now inlined (`.gitmodules` empty), these are **vestigial no-ops** — no `SUBMODULE_PAT` is required to build.
