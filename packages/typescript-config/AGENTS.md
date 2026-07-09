# packages/typescript-config - agent notes

Shared TypeScript config package.

- Changes here affect app and package typechecking across the repo.
- Keep configs framework-specific where needed; do not force Next-only settings
  onto plain library packages.
- After edits, run `pnpm typecheck`.
