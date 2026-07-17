# packages/core - agent notes

Shared domain logic and feature UI. Read the root [CLAUDE.md](../../CLAUDE.md)
first.

- Apps import `@workspace/core`; core must never import from `apps/*`.
- Organize code feature-first under `src/<feature>/`.
- Keep service APIs stable because all three frontends consume them.
- Roadmap backend selection is env-driven: `NEXT_PUBLIC_SVC_API_URL` enables the
  real `svc-api` GraphQL backend (Apollo Client in `src/roadmap/api/`); empty
  means mock/localStorage fallback. `NEXT_PUBLIC_SVC_ROADMAP_URL` is the legacy
  name, still honored as a fallback.
- `next-themes` imports are aliased by the apps to
  `src/navigation/no-script-next-themes.tsx` to avoid React 19 script warnings.
- Update package barrels (`index.ts`) when adding public exports.
