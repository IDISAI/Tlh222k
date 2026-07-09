# packages

Shared workspace packages live here.

| Folder              | Package                        | Purpose                                    |
| ------------------- | ------------------------------ | ------------------------------------------ |
| `core`              | `@workspace/core`              | Shared domain logic and feature UI         |
| `db`                | `@workspace/db`                | Prisma schema, generated client, seed data |
| `ui`                | `@workspace/ui`                | shadcn/ui + Tailwind v4 components         |
| `eslint-config`     | `@workspace/eslint-config`     | Shared ESLint config                       |
| `typescript-config` | `@workspace/typescript-config` | Shared TS config                           |

Packages can depend on other packages, but must never import from `apps/*`.
Keep reusable logic here rather than duplicating it inside apps.
