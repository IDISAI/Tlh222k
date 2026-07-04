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

## Git submodules (critical)

Two working paths are git submodules, each its own repo:

| Path | Repo |
|------|------|
| `packages/ui` | `git@github.com:IDISAI/ui.git` |
| `packages/core/src/roadmap` | `git@github.com:IDISAI/roadmap.git` |

- Clone with `git clone --recurse-submodules`, or after clone run `git submodule update --init --recursive`. A missing submodule means empty dirs and a broken build (`web` needs `@workspace/ui`; `packages/core/src/index.ts` re-exports `./roadmap`).
- Editing submodule code = commit **in the child repo**, then in the parent repo commit the updated gitlink to pin the new version.
- Setup/procedure is documented in [docs/onboarding/submodules.md](docs/onboarding/submodules.md).

## Architecture

**What exists today:** two Next.js frontends (`apps/web`, `apps/admin`) plus shared `packages/*`. `apps/admin` mirrors `apps/web` (dev on port 3002) and mounts core features (`NotionView`, `GraphView`); `web` mounts `RoadmapView`. `apps/super-admin` is still an empty placeholder. The docs under [docs/onboarding/](docs/onboarding/) describe a larger **target** system (NestJS `api-gateway`, Prisma `packages/db`, admin CMS, Playwright e2e) that is **not built yet** — treat those as roadmap, not current state.

**Dependency direction** (enforced by convention, see [rules/packages.md](rules/packages.md)):
```
apps/*  →  packages/*        ✓
packages/* → apps/*          ✗ never
```

**`packages/core` (`@workspace/core`)** — all domain logic lives here, organized feature-first:
```
src/<feature>/            e.g. roadmap/ (submodule), notion/
  <sub-feature>/          e.g. roadmap/graph, notion/{content-editor,sidebar,search}
```
Every feature/sub-feature follows the same shape: `types.ts`, `<slug>.service.ts`, `hooks/`, `components/`, `utils/`, and an `index.ts` barrel that re-exports them (parent features also re-export their sub-features up to `src/index.ts`). `core` uses `moduleResolution: Bundler` so barrels can `export *` without file extensions.

**Consuming a package from an app:** add `"@workspace/<pkg>": "workspace:*"` to the app's deps, add it to `transpilePackages` in `next.config.ts`, and map it under `paths` in the app's `tsconfig.json` (see `apps/web`). `apps/web/lib/core.ts` is the reference example of importing core and customizing per-app.

**Package naming is `@workspace/*`** (e.g. `@workspace/ui`, `@workspace/core`). Some docs/rules mention `@vizteck/*` — that is outdated; the real scope is `@workspace`.

## Next.js version warning

This repo pins a modified Next.js (see [AGENTS.md](AGENTS.md)) with breaking changes vs. common knowledge. Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`.

## CI/CD

Three workflows in `.github/workflows/` (see [docs/onboarding/cicd.md](docs/onboarding/cicd.md)):
- `ci.yml` — PRs + push to `main`/`develop`/`release/**`: lint → typecheck → build.
- `deploy-staging.yml` — push `develop`/`release/**`: Vercel preview (web).
- `release.yml` — tag `v*`: Vercel production (web) + GitHub Release.

Deploys cover **web + admin** (matrix job per app) and require GitHub secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_WEB`, `VERCEL_PROJECT_ID_ADMIN`; each Vercel project's Root Directory = `apps/web` / `apps/admin`.

Because `packages/ui` and the `core` features are **private submodules**, every workflow checks out with `submodules: recursive` and `token: ${{ secrets.SUBMODULE_PAT || github.token }}` — set `SUBMODULE_PAT` (a PAT with read access to the `IDISAI/*` submodule repos) or the build fails to fetch them.
