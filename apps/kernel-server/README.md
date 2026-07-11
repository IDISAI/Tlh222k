# kernel-server

Go backend for the notebook feature. **Phase 2:** notebook CRUD (filesystem
store) + Clerk-gated auth + CORS, so the admin editor and the web `/learn`
viewer read/write the **same** notebooks. **Phase 3 (planned):** a Jupyter
WebSocket proxy for live code execution.

It is a standalone Go module (not part of the pnpm/turbo workspace), so it does
not affect the JS `lint → typecheck → build` CI.

## Run (dev)

```bash
cp .env.example .env
DEV_AUTH_ROLE=super-admin go run ./cmd/server   # listens on :3006
```

`DEV_AUTH_ROLE` bypasses JWT verification for local dev (mirrors the web apps'
`NEXT_PUBLIC_DEV_AUTH_ROLE`). Leave it empty in production and set
`CLERK_JWKS_URL` so session JWTs are verified against Clerk.

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
