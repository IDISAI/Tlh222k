<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project agent rules

Canonical guidance for AI agents lives in [CLAUDE.md](CLAUDE.md) — read it first (commands, architecture, conventions). Key points that bite if missed:

- **Submodules:** `packages/ui` (`IDISAI/ui`) and `packages/core/src/roadmap` (`IDISAI/roadmap`) are separate repos. Clone with `--recurse-submodules` or run `git submodule update --init --recursive`, else the build breaks. Editing submodule code = commit in the child repo, then bump the gitlink in the parent. Procedure: [docs/onboarding/submodules.md](docs/onboarding/submodules.md).
- **`lint` ≠ `typecheck`:** they are distinct turbo tasks. There is no test runner. CI = `install --frozen-lockfile → lint → typecheck → build`.
- **Package scope is `@workspace/*`** (not `@vizteck/*`). `apps/*` may import `packages/*`, never the reverse — see [rules/packages.md](rules/packages.md).
- **Domain logic goes in `packages/core`** feature-first (`types.ts` / `*.service.ts` / `hooks/` / `components/` / `utils/` + barrel). Apps import and customize per-app (see `apps/web/lib/core.ts`).
- Docs under `docs/onboarding/` describe a larger **target** system (NestJS api-gateway, Prisma, admin CMS) that is not built yet — treat as roadmap, not current state.
