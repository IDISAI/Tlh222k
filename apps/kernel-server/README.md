# kernel-server

Go backend for notebook CRUD and live Jupyter execution: Clerk-gated API,
filesystem store, HTTP/WebSocket proxy, short-lived HttpOnly session cookies,
and fixed-policy Docker broker.

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

Container deployments must configure `JUPYTER_BROKER_URL` and a random 32+
byte `JUPYTER_BROKER_TOKEN`. Kernel-server image has no Docker CLI/socket; only
non-root broker sidecar mounts socket and it accepts fixed session/profile input.

Point the Next apps at it with `NEXT_PUBLIC_KERNEL_SERVER_URL=http://localhost:3006`
(web + admin `.env.local`). If unset, web falls back to committed `.ipynb`
fixtures and the admin editor uses per-browser localStorage.

## Runtime images

Python `data-science` and `ml-cpu` images remain part of the default Compose
stack. Other languages are opt-in profiles: broker startup does not build them.
Build only the language needed:

```bash
docker compose --profile runtime-javascript build runtime-javascript
docker compose --profile runtime-cpp build runtime-cpp
docker compose --profile runtime-java build runtime-java
docker compose --profile runtime-rust build runtime-rust
docker compose --profile runtime-go build runtime-go
docker compose --profile runtime-julia build runtime-julia
```

Each image contains one canonical kernelspec consumed by notebook metadata:

| Language | Image | Kernelspec |
| --- | --- | --- |
| JavaScript | `local/notebook-javascript:dev` | `deno` |
| C++ | `local/notebook-cpp:dev` | `xcpp17` |
| Java | `local/notebook-java:dev` | `java` |
| Rust | `local/notebook-rust:dev` | `rust` |
| Go | `local/notebook-go:dev` | `gophernotes` |
| Julia | `local/notebook-julia:dev` | `julia` |

Smoke-test installed kernels without starting Jupyter Server:

```bash
docker run --rm local/notebook-javascript:dev jupyter kernelspec list --json
docker run --rm local/notebook-cpp:dev jupyter kernelspec list --json
docker run --rm local/notebook-java:dev jupyter kernelspec list --json
docker run --rm local/notebook-rust:dev jupyter kernelspec list --json
docker run --rm local/notebook-go:dev jupyter kernelspec list --json
docker run --rm local/notebook-julia:dev jupyter kernelspec list --json
```

Remove local language images when reclaiming Docker disk:

```bash
docker image rm local/notebook-javascript:dev local/notebook-cpp:dev local/notebook-java:dev local/notebook-rust:dev local/notebook-go:dev local/notebook-julia:dev
```

## API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | — | liveness |
| GET | `/api/notebooks` | admin | list notebook summaries |
| GET | `/api/notebooks/{slug}` | admin | fetch one (for editing) |
| PUT | `/api/notebooks/{slug}` | admin | create/update `{notebook, title, published, runtimeProfile}` |
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
