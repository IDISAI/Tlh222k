# packages/ui - agent notes

Shared UI package (shadcn/ui + Tailwind v4). This folder is inline source, not a
submodule.

- There is no build step. `exports` in [package.json](package.json) point at
  source files under `src/`.
- Add shadcn components from the repo root:
  `pnpm dlx shadcn@latest add <name> -c apps/web`.
- Do not hand-write a primitive if shadcn provides it.
- Internal imports should use `@workspace/ui/*` instead of deep relatives.
- Changing exports requires checking all app consumers.
