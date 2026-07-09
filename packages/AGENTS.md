# packages - agent notes

Read the root [CLAUDE.md](../CLAUDE.md) first.

- Package scope is `@workspace/*`.
- `apps/* -> packages/*` is allowed. `packages/* -> apps/*` is forbidden.
- Shared domain behavior belongs in `packages/core`.
- Shared visual primitives belong in `packages/ui`.
- Database schema/client/seed code belongs in `packages/db`.
- Keep package exports stable; changing exports can break every app.
- Add or update the local `README.md` and `AGENTS.md` when a package's role,
  commands, env, or boundaries change.
