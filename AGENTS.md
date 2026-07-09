<!-- codebase-memory-mcp:start -->

# Codebase Knowledge Graph (codebase-memory-mcp)

This project uses codebase-memory-mcp to maintain a knowledge graph of the
codebase. Prefer graph tools over grep/glob/file search when they are available.

Priority order:

1. `search_graph` - find functions, classes, routes, variables by pattern
2. `trace_path` - trace callers/callees or data flow
3. `get_code_snippet` - read exact function/class source
4. `query_graph` - run Cypher for complex patterns
5. `get_architecture` - high-level project summary

Fallback to `rg`/file reads when the graph is not indexed, when searching
non-code files, or when looking for string literals/config values.

<!-- codebase-memory-mcp:end -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This repo pins Next.js 16.2.6 and may differ from your training data. Before
editing Next.js code, read the relevant guide in the installed docs. With pnpm,
the docs may live under `node_modules/.pnpm/.../node_modules/next/dist/docs/`
instead of `node_modules/next/dist/docs/`.

<!-- END:nextjs-agent-rules -->

# Project Agent Rules

Read [CLAUDE.md](CLAUDE.md) first. It is the canonical agent guide for commands,
architecture, env, package boundaries, and verification.

Key points:

- `packages/ui` and `packages/core/src/roadmap` are no longer submodules. They
  are inline source folders; commit them in this repo like normal code.
- `lint` and `typecheck` are separate Turborepo tasks. There is no test runner.
  CI is `install --frozen-lockfile -> lint -> typecheck -> build`.
- Package scope is `@workspace/*`. Apps may import packages; packages must never
  import apps. See [rules/packages.md](rules/packages.md).
- Domain logic belongs in `packages/core`, feature-first. Apps import and adapt
  it per app.
- Env files are intentionally per app/package. Do not create a shared root app
  env. See [docs/onboarding/env.md](docs/onboarding/env.md).
- Every committed workspace folder should have a `README.md` for humans and an
  `AGENTS.md` for AI-agent notes. Do not add these files to generated folders
  such as `node_modules`, `.next`, `dist`, `.turbo`, or `.git`.
