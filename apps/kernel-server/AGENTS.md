# AGENTS — kernel-server

- Standalone **Go** module (`go.mod`), intentionally OUTSIDE the pnpm/turbo
  workspace so it never enters the JS `lint → typecheck → build` CI. Verify with
  `go build ./...` and `go vet ./...` from this directory.
- **Stdlib only** — no third-party deps (keeps `go build` offline and the
  dependency surface tiny). Don't add modules without a strong reason.
- Notebooks are **opaque `.ipynb` bytes** here. All nbformat parsing/validation
  lives in the TS `NotebookService` (`packages/core/src/notebook`). Do NOT add a
  Go nbformat parser — the two must not diverge.
- Auth: `DEV_AUTH_ROLE` bypass for dev; otherwise Clerk JWKS RS256 verification.
  `RequireAdmin` gates every mutating route; only `/api/published/*` is public.
- The `store.Store` interface is the seam for a future Postgres store — keep new
  persistence behind it.
- Phase 3 will add a Jupyter WebSocket **passthrough** proxy (this server checks
  auth and relays frames; it does NOT implement the Jupyter messaging protocol —
  the browser's `@jupyterlab/services` does).
