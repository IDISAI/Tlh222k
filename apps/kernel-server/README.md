# kernel-server

Go backend for the notebook feature. **Phase 2:** notebook CRUD (filesystem
store) + Clerk-gated auth + CORS, so the admin editor and the web `/learn`
viewer read/write the **same** notebooks. **Phase 3 (planned):** a Jupyter
WebSocket proxy for live code execution.

It is a standalone Go module (not part of the pnpm/turbo workspace), so it does
not affect the JS `lint → typecheck → build` CI.

## Run (dev)

```bash
pnpm dev
```

Root dev command starts Turbo apps and this Go service together. The dev
launcher defaults `DEV_AUTH_ROLE` to `super-admin`; set it explicitly to use a
different local role. To run only this service:

```bash
APP_ENV=development \
DEV_AUTH_ROLE=super-admin \
SESSION_TICKET_SECRET=development-only-ticket-secret \
go run ./cmd/server   # listens on :3006
```

`DEV_AUTH_ROLE` bypasses JWT verification only when `APP_ENV=development` or
`test` (mirrors the web apps' `NEXT_PUBLIC_DEV_AUTH_ROLE`). Production defaults
fail closed: set `APP_ENV=production`, leave `DEV_AUTH_ROLE` empty, configure
`CLERK_JWKS_URL`, `CLERK_ISSUER`, `CLERK_AUDIENCE`, and use a random
`SESSION_TICKET_SECRET` of at least 32 bytes.

Runtime capacity counts launches still in progress. `JUPYTER_MAX_SESSIONS`
limits the server globally; `JUPYTER_MAX_SESSIONS_PER_OWNER` defaults to `1`
to prevent one identity from exhausting all kernel slots.

Point the Next apps at it with `NEXT_PUBLIC_KERNEL_SERVER_URL=http://localhost:3006`
(web + admin `.env.local`). If unset, web falls back to committed `.ipynb`
fixtures and the admin editor uses per-browser localStorage.

## API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | — | liveness |
| GET | `/api/notebooks` | admin | list notebook summaries |
| GET | `/api/notebooks/{slug}` | admin | fetch one (for editing) |
| PUT | `/api/notebooks/{slug}` | admin | create/update `{notebook, title, published}` |
| DELETE | `/api/notebooks/{slug}` | admin | delete |
| GET | `/api/published/{slug}` | public | web viewer read (published only) |

Notebooks are opaque `.ipynb` JSON to this server — all nbformat parsing lives
in the TypeScript `NotebookService`.

## Layout

```
cmd/server/main.go      wiring: config → store → routes → auth → CORS → listen
internal/config         env loading
internal/store          FSStore (opaque .ipynb bytes + .meta.json sidecar)
internal/auth           dev bypass + Clerk JWKS RS256 verify + RequireAdmin
internal/api            HTTP handlers
internal/httpx          CORS middleware
storage/notebooks       notebook blobs (gitignored)
```

## Deploy note

Not a Vercel serverless function — it needs a persistent filesystem (and, in
Phase 3, long-lived WebSockets + a Jupyter process). Run it as a long-running
service (Fly/Railway/VPS). Real kernel execution must run sandboxed before any
shared/production deploy (see `docs/notebook-feature/prompt.md`).
