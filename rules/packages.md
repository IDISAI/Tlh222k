# Package Rules

## Dependency direction

```
apps/*       →  packages/*   ✓
packages/*   →  apps/*       ✗ never
```

Ví dụ hợp lệ:
```ts
// apps/web/app/page.tsx
import { RoadmapView } from "@workspace/core"   // ✓
import { Button } from "@workspace/ui/components/button"  // ✓
```

Ví dụ vi phạm:
```ts
// packages/core/src/roadmap/...
import something from "../../apps/web/..."  // ✗
```

## Packages hiện có

| Package | Scope | Vai trò |
|---------|-------|---------|
| `packages/core` | `@workspace/core` | Toàn bộ domain logic — feature-first |
| `packages/ui` | `@workspace/ui` | React components (shadcn/ui + Tailwind v4) |
| `packages/eslint-config` | `@workspace/eslint-config` | Shared ESLint config |
| `packages/typescript-config` | `@workspace/typescript-config` | Shared tsconfig |

## Core package layout

```
packages/core/src/
  roadmap/          ← feature (git submodule: IDISAI/roadmap)
    graph/          ← sub-feature
  navigation/       ← feature
  index.ts          ← barrel, re-export tất cả features
```

Mỗi feature/sub-feature: `types.ts`, `*.service.ts`, `hooks/`, `components/`, `utils/`, `index.ts`

## Thêm feature mới vào core

1. Tạo `src/<feature>/` với đúng khuôn trên
2. Thêm `export * from "./<feature>"` vào `src/index.ts`
3. Feature là submodule riêng → tạo repo, thêm submodule, rồi bước 1-2 trong submodule đó
