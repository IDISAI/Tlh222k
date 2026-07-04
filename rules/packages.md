# Package Rules

## Dependency direction

- `apps/*` → `packages/*` ✓
- `packages/core` → `packages/graphql-client`, `@xyflow/react`, `packages/ui` ✓
- `packages/graph`, `packages/lesson` → `packages/core` only ✓
- `packages/*` → `apps/*` ✗ never

## Shim packages (graph, lesson)

- `packages/graph` and `packages/lesson` are re-export shims only
- Do NOT add source files to them — all logic goes in `packages/core`

## Core package layout

```
packages/core/src/
  roadmap/          <- This is a feature
    graph/          <- This is a sub-feature
  lesson/             <- This is a feature
    content-editor/ ← This is a sub-feature
    page-tree/      <- This is a sub-feature
    search/         <- This is a sub-feature
```

Each feature/sub-feature: `types.ts`, `*.service.ts`, `hooks/`, `components/`, `utils/`
