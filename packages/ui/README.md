# @workspace/ui

Shared UI primitives and components built on shadcn/ui and Tailwind v4.

## Exports

```ts
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import "@workspace/ui/globals.css"
```

See [package.json](package.json) for the full export map. There is no package
build step; apps import TypeScript source directly.

## Add A Component

Run from the repo root. The generated component lands in `src/components/`:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

Do not hand-write a primitive when shadcn already provides one.

## Notes

- This folder is inline source, not a submodule.
- Changing `exports` can break every app importing `@workspace/ui`.
