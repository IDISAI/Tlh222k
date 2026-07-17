# Security Hardening Verification — 2026-07-16 audit

Verification record for the P1/P2 findings remediated by the
[2026-07-16 hardening plan](../superpowers/plans/2026-07-16-security-hardening-stability-evidence.md).
Fresh verification run executed 2026-07-17 on branch `verify/security-evidence`
(base `refactor`, contains all hardening commits).

## Commits under verification

| Commit    | Scope                                                        |
| --------- | ------------------------------------------------------------ |
| `8c02c83` | fix(kernel): fail closed on auth configuration                |
| `d862580` | fix(kernel): serialize store and reserve session capacity     |
| `04bebcf` | fix(kernel): replace query tickets and isolate Docker control |
| `fe2fd44` | fix(api): enforce transactional tree integrity                |
| `6d019f1` | fix(platform): validate inputs and persist update events      |
| `c8537ba` | fix(admin): guard privileged changes and public content       |
| `ab69798` | ci: gate and package backend services                         |

## Fresh verification results (2026-07-17)

All commands run from a clean checkout of the branch in the dedicated
worktree (`pnpm install --frozen-lockfile` first, Prisma client regenerated).

| Gate                              | Result | Notes                                             |
| --------------------------------- | ------ | ------------------------------------------------- |
| `pnpm lint`                       | PASS   | 7/7 tasks, 0 errors (62 pre-existing warnings)    |
| `pnpm typecheck`                  | PASS   | 7/7 tasks                                         |
| `pnpm test --force`               | PASS   | 87 tests: svc-api 34, core 34, admin 16, super-admin 3 (admin +1 new CI assertion afterwards) |
| `pnpm build --force`              | PASS   | After CI-gap fix below; all apps produce production builds |
| `go test ./...` (kernel-server)   | PASS   | 8 packages, all green                             |
| `go test -race ./...`             | NOT RUN LOCALLY | Requires cgo/gcc, absent on this Windows host. Enforced in CI (`ci.yml`) on ubuntu; runs on next PR. |
| `go vet ./...`                    | PASS   |                                                   |
| `go build ./...`                  | PASS   |                                                   |
| `git diff --check`                | PASS   | No whitespace errors                              |

### Regression found and fixed during this verification

`pnpm build` initially **failed** for `admin` and `super-admin`:
`Error: NEXT_PUBLIC_SVC_API_URL is required in production`. The Task 5
fail-closed service selector (by design) aborts production builds without a
backend URL — but `ci.yml`'s build step supplied no such value, so the CI gate
introduced in Task 7 would have failed on its first real run. Fixed by
supplying a build-gate placeholder env in `ci.yml` and extending
`apps/admin/ci/workflow-policy.test.ts` with an assertion for it
(RED observed as the build failure above; GREEN: 4/4 workflow-policy tests).
Real values continue to live only in the Vercel project env.

## Finding-by-finding map

Each P1/P2 cluster from the audit maps to source fix, automated test, runtime
evidence, and residual risk.

### 1. Kernel JWT validation + production startup gate (P1)

- **Source fix**: `apps/kernel-server/internal/auth/auth.go`,
  `internal/config/config.go`, `cmd/server/main.go` (`8c02c83`).
- **Automated test**: `internal/auth/auth_test.go` (temporal/issuer/audience
  claims, bounded JWKS refresh), `internal/config/config_test.go`
  (production rejects dev role and incomplete JWT config). All pass in
  `go test ./...`.
- **Runtime evidence**: starting the server without `DEV_AUTH_ROLE` and
  without a sandbox runtime exits fatally
  (`reconcile notebook containers: … exit status 1`, observed 2026-07-17);
  dev instance logs the explicit
  `DEV_AUTH_ROLE="super-admin" — auth bypass ON (dev only)` warning.
- **Residual risk**: JWKS behaviour against live Clerk unexercised locally
  (network-isolated tests only).

### 2. Store serialization + session capacity (P1)

- **Source fix**: `internal/store/store.go`, `internal/sessions/manager.go`
  (`d862580`).
- **Automated test**: `internal/store/store_test.go`,
  `internal/sessions/manager_test.go` (concurrent save/load pair consistency,
  non-blocking touch, capacity reservation). Pass in `go test ./...`.
- **Runtime evidence**: kernel-server serves notebook CRUD in QA run (below).
- **Residual risk**: race detector not run on this host (no cgo); `-race` is
  enforced in CI on Linux.

### 3. Query-string tickets removed + Docker broker isolation (P1)

- **Source fix**: `internal/proxy/ticket.go`, `internal/proxy/jupyter.go`,
  `internal/broker/`, `internal/runtime/broker.go`,
  `packages/core/src/notebook/kernel/session-client.ts` (`04bebcf`).
- **Automated test**: `internal/proxy/*_test.go` (query ticket rejected,
  scoped `__Host-kernel-ticket` cookie rotated), `internal/broker/server_test.go`,
  `session-client.test.ts`. Pass.
- **Runtime evidence**: QA run — proxy returns **401** for a session URL with
  no ticket cookie and **400** for `?ticket=forged` (query secrets rejected
  outright; video + screenshots).
- **Residual risk**: full Docker broker path (socket isolation, non-root
  images) not exercised locally in this run — Docker Desktop unavailable
  (C: disk exhaustion). Covered by broker unit tests and compose config;
  live-session ticket rotation was previously verified 2026-07-14 with the
  compose stack.

### 4. Acyclic tree invariants + transactional saves (P1)

- **Source fix**: `apps/svc-api/src/roadmap/tree-invariants.ts`,
  `roadmap.service.ts`, `notion.service.ts` (`fe2fd44`).
- **Automated test**: `tree-invariants.spec.ts`, `roadmap.service.spec.ts`,
  `notion.service.spec.ts` — cycle/self-parent/dangling rejection,
  cross-roadmap rejection, Serializable + timeout transaction options,
  advisory-locked Notion moves. Pass (svc-api 34/34).
- **Runtime evidence**: admin roadmap load/edit flows in QA run operate
  through these code paths against the Neon dev branch.
- **Residual risk**: Serializable-conflict retry behaviour under real
  concurrent load not measured.

### 5. DTO validation, fail-closed config, durable SSE (P1/P2)

- **Source fix**: `apps/svc-api/src/bootstrap.ts` (global `ValidationPipe`
  whitelist/forbidNonWhitelisted/transform, fail-closed production CORS),
  roadmap/notion DTOs, `RoadmapUpdateEvent` Prisma model, DB-polling
  `RoadmapEventsService`, production-throwing service selector (`6d019f1`).
- **Automated test**: `bootstrap.spec.ts`, `roadmap/dto.spec.ts`,
  `sse/roadmap-events.service.spec.ts`,
  `packages/core/src/roadmap/api/service-selector.test.ts`. Pass.
- **Runtime evidence**: production builds abort without backend URL (observed
  as the CI regression above — the fail-closed path works); QA run exercises
  validated mutation paths.
- **Residual risk**: multi-instance SSE fan-out verified by unit tests
  against a mocked Prisma cursor, not with two live API instances.

### 6. Privileged role changes, upload policy, Notion privacy (P1/P2)

- **Source fix**: `apps/super-admin/app/api/users/[id]/role/policy.ts` +
  route, `apps/admin/app/notion/upload-policy.ts` + actions,
  `authorId` removed from public Notion responses (`c8537ba`).
- **Automated test**: `policy.test.ts` (self-demotion, last-super-admin),
  `upload-policy.test.ts` (SVG/HTML/executable/archive rejected, filename
  sanitized, explicit contentType), Notion privacy assertions. Pass
  (admin 16, super-admin 3).
- **Runtime evidence**: super-admin app builds and serves; role-change flow
  requires live Clerk sessions and was validated at the policy layer.
- **Residual risk**: Clerk session revocation and pagination against the live
  Clerk API untested locally (no Clerk secrets in evidence run — by design).

### 7. CI/release gates (P2)

- **Source fix**: `.github/workflows/ci.yml` (Go race/vet/build gates),
  `deploy-staging.yml`/`release.yml` (svc-api matrix leg, pinned Vercel CLI),
  `kernel-image.yml` (immutable GHCR `${{ github.sha }}` tag, minimal
  permissions) (`ab69798` + build-gate env fix in this verification).
- **Automated test**: `apps/admin/ci/workflow-policy.test.ts` — 4/4 pass.
- **Runtime evidence**: none yet — workflows run on GitHub; branch not pushed.
  First PR to `main` will execute all gates, including `go test -race`.
- **Residual risk**: production GHCR image deployment requires an operator
  with a host and secrets (documented, out of repo scope).

## Browser QA evidence (Task 8)

_Recorded 2026-07-17 with Playwright chromium against locally served
production builds (web `next start` :3000, admin :3002) + kernel-server
(:3006, dev role, random ticket secret) + svc-api (:3005, Neon **dev** branch —
verified via Neon API that endpoint `ep-wispy-thunder-atxg5fp4` belongs to
branch `dev`, not `production`). No production secrets used._

**18/18 automated steps pass; zero unexpected browser console errors.**
Full step table: [`.gstack/qa-reports/qa-report-localhost-2026-07-17.md`](../../.gstack/qa-reports/qa-report-localhost-2026-07-17.md).

The recording demonstrates, in one continuous 103-second session:

1. **web roadmap navigation** — home, roadmap list (live svc-api data),
   roadmap tree viewer, node panel (desktop and 375x812 mobile);
2. **admin roadmap load/edit and validation** — CMS list, builder, and a
   create-roadmap submit with empty title rejected in-dialog
   ("Tên roadmap không được để trống");
3. **kernel health/session authorization** — `/health` 200, authorized
   notebook listing, Jupyter proxy **401** without the scoped ticket cookie,
   **400** for a forged `?ticket=` query parameter;
4. **no console errors** on any tested page — the only two console entries
   are the intentional 401/400 authorization rejections above.

Note: the admin zone ran under `next dev` because the
`NEXT_PUBLIC_DEV_AUTH_ROLE` Clerk bypass is — by design — ignored in
production builds (a production admin serves the real Clerk sign-in, itself
verified during this run). Web ran its production build.

## Artifacts

All under `.gstack/qa-reports/` (committed with `git add -f`; the directory
is normally gitignored):

| Artifact | Detail |
| -------- | ------ |
| `stability-evidence.webm` | 103s, 5.85 MB, SHA256 `83E6725384B109E0906E81D4CB0CF2411B2871C09B301B37C731177FE1338E59` |
| `screenshots/01…18-*.png` | one per QA step |
| `qa-run-2026-07-17.json` | machine-readable step + console results |
| `baseline.json` | command gates + service environment baseline |
| `qa-report-localhost-2026-07-17.md` | human-readable QA report |

## Outstanding / not claimed

- `go test -race` executes only in CI (local host lacks cgo toolchain).
- Live Docker sandbox sessions (Jupyter execution, ticket cookie rotation
  end-to-end) not re-verified in this run: Docker Desktop down, C: disk full.
  Prior live verification: 2026-07-14 compose stack.
- CI workflows have not yet executed on GitHub for these commits (branch not
  pushed at time of writing).
