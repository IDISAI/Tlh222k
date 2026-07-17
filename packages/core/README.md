# @workspace/core

Shared domain logic and feature UI for all frontends. Apps import this package;
`core` must never import from `apps/*`.

## Structure

```text
src/<feature>/
  types.ts
  <feature>.service.ts
  hooks/
  components/
  utils/
  index.ts
```

Current major features include `roadmap`, `navigation`, and `notebook`.

## Roadmap Data

`NEXT_PUBLIC_SVC_API_URL` controls the data source (`api/` = Apollo Client +
provider):

- set: use the real `svc-api` GraphQL backend
- empty: use the mock/localStorage fallback

`NEXT_PUBLIC_SVC_ROADMAP_URL` is the legacy name, still honored as a fallback
after the `svc-roadmap` -> `svc-api` rename.

## Theme

Apps alias `next-themes` to `src/navigation/no-script-next-themes.tsx` so
`useTheme()` works without rendering an inline script in React 19.

## Import

```ts
import { RoadmapService, type Roadmap } from "@workspace/core"
```
