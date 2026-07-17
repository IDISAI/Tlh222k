# apps

Runtime applications live here.

| Folder        | Purpose                                        | Default port |
| ------------- | ---------------------------------------------- | ------------ |
| `web`         | Public Next.js frontend and Multi-Zone host    | 3000         |
| `admin`       | Next.js roadmap builder/admin child zone       | 3002         |
| `super-admin` | Next.js super-admin/user-management child zone | 3003         |
| `svc-api` | NestJS GraphQL/REST/SSE backend                | 3005         |

Each app owns its env file and has its own `README.md` and `AGENTS.md`.

Run one app with:

```bash
pnpm --filter <app-name> dev
```

See the root [README.md](../README.md) and [docs/onboarding/env.md](../docs/onboarding/env.md).
