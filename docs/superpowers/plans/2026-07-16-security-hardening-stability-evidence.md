# Security Hardening and Stability Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every P1/P2 risk from the 2026-07-16 audit, prove regressions with automated tests, and capture a browser video showing stable user-facing flows.

**Architecture:** Harden each trust boundary independently: strict JWT validation and guarded development auth; serialized notebook/session state; validated acyclic roadmap/document trees; durable database-backed update events; fail-closed production configuration; safer privileged operations and CI gates. Preserve current local-development fallbacks, but make production configuration explicit and fatal when missing.

**Tech Stack:** Go 1.26 stdlib plus existing `nhooyr.io/websocket`; NestJS 10, Prisma 6, RxJS, Vitest 4; Next.js 16.2.6; pnpm/Turborepo; GitHub Actions; Playwright 1.61.1.

## Global Constraints

- Follow `CLAUDE.md`, all scoped `AGENTS.md` files, and Next.js 16.2.6 installed documentation before editing Next.js code.
- Keep `apps/kernel-server` outside pnpm/Turbo; verify it with `go test ./...`, `go vet ./...`, and `go build ./...` from that directory.
- Keep nbformat parsing in `packages/core/src/notebook`; do not add a Go parser.
- Packages must never import apps. Apps may import `@workspace/*` packages.
- Use test-first RED -> GREEN for every behavior change. Do not modify production code before observing the regression test fail for the expected reason.
- Do not stage or copy `D:/lh222k/lh222k/.claude/settings.local.json`.
- Final evidence must include fresh lint, typecheck, test, build, Go race/vet/build results and a browser-recorded video artifact.

---

### Task 1: Strict kernel authentication and production startup gate

**Files:**

- Create: `apps/kernel-server/internal/auth/auth_test.go`
- Create: `apps/kernel-server/internal/config/config_test.go`
- Modify: `apps/kernel-server/internal/auth/auth.go`
- Modify: `apps/kernel-server/internal/config/config.go`
- Modify: `apps/kernel-server/cmd/server/main.go`
- Modify: `apps/kernel-server/compose.yaml`
- Modify: `apps/kernel-server/README.md`
- Modify: `docs/onboarding/env.md`

**Interfaces:**

- Produces `auth.Options{DevRole, JWKSURL, Issuer, Audience, HTTPClient, Now}` and `auth.New(options)`.
- Produces `config.Config.Validate() error`; production requires issuer, audience, JWKS URL, non-default ticket secret, and no dev role.

- [ ] **Step 1: Write failing JWT and config tests**

```go
func TestVerifyRequiresTemporalIssuerAndAudienceClaims(t *testing.T) {
    // Generate one RSA key, serve its JWKS from httptest.Server, sign table-case
    // tokens missing exp, with expired exp, future nbf, wrong iss, wrong aud,
    // and one valid token. Only the valid token must authenticate.
}

func TestUnknownKidRefreshIsBoundedAndUsesHTTPTimeout(t *testing.T) {
    // Count JWKS requests. Concurrent unknown kids after an initial refresh must
    // cause at most one additional refresh inside the throttle window.
}

func TestProductionRejectsDevAuthAndIncompleteJWTConfig(t *testing.T) {
    cfg := Config{Environment: "production", DevAuthRole: "super-admin"}
    if err := cfg.Validate(); err == nil { t.Fatal("production dev bypass accepted") }
}
```

- [ ] **Step 2: Verify RED**

Run: `go test ./internal/auth ./internal/config`

Expected: compile failure because `auth.Options`, new constructor, and `Config.Validate` do not exist.

- [ ] **Step 3: Implement strict claims and bounded JWKS refresh**

```go
type Options struct {
    DevRole, JWKSURL, Issuer, Audience string
    HTTPClient *http.Client
    Now func() time.Time
}

func validateClaims(claims map[string]any, issuer, audience string, now time.Time) error {
    exp, ok := numericDate(claims["exp"])
    if !ok || now.Unix() >= exp { return errors.New("token expired or missing exp") }
    if nbf, exists := claims["nbf"]; exists {
        value, ok := numericDate(nbf)
        if !ok || now.Unix() < value { return errors.New("token not active") }
    }
    if claims["iss"] != issuer { return errors.New("unexpected issuer") }
    if !claimAudienceContains(claims["aud"], audience) { return errors.New("unexpected audience") }
    return nil
}
```

Use a 5-second `http.Client` timeout, 1 MiB `io.LimitReader`, status-code validation, one `refreshMu`, and a 30-second unknown-key refresh throttle. Reject empty `kid`, empty JWKS, invalid RSA modulus/exponent, and invalid roles.

- [ ] **Step 4: Implement production startup validation**

```go
func (c Config) Validate() error {
    if c.Environment == "production" {
        if c.DevAuthRole != "" { return errors.New("DEV_AUTH_ROLE is forbidden in production") }
        if c.ClerkJWKSURL == "" || c.ClerkIssuer == "" || c.ClerkAudience == "" {
            return errors.New("CLERK_JWKS_URL, CLERK_ISSUER and CLERK_AUDIENCE are required")
        }
    }
    return nil
}
```

Set `APP_ENV=development` explicitly in compose. Call `cfg.Validate()` before constructing store/runtime/authenticator.

- [ ] **Step 5: Verify GREEN and race safety**

Run: `go test -race ./internal/auth ./internal/config ./cmd/server`

Expected: all tests pass, zero race reports.

- [ ] **Step 6: Commit**

```bash
git add apps/kernel-server/internal/auth apps/kernel-server/internal/config apps/kernel-server/cmd/server apps/kernel-server/compose.yaml apps/kernel-server/README.md docs/onboarding/env.md
git commit -m "fix(kernel): enforce production authentication invariants"
```

---

### Task 2: Concurrency-safe notebook store and non-blocking session capacity

**Files:**

- Modify: `apps/kernel-server/internal/store/store.go`
- Modify: `apps/kernel-server/internal/store/store_test.go`
- Modify: `apps/kernel-server/internal/sessions/types.go`
- Modify: `apps/kernel-server/internal/sessions/manager.go`
- Modify: `apps/kernel-server/internal/sessions/manager_test.go`
- Modify: `apps/kernel-server/internal/config/config.go`
- Modify: `apps/kernel-server/cmd/server/main.go`

**Interfaces:**

- `FSStore` owns one `sync.RWMutex`; reads use `loadUnlocked` while mutations hold the write lock.
- `sessions.Options.MaxSessionsPerOwner` defaults to `1` and capacity counts in-flight starts.

- [ ] **Step 1: Write failing concurrency tests**

```go
func TestFSStoreConcurrentSaveLoadKeepsNotebookMetadataPairConsistent(t *testing.T) {
    // Run two writers with title/body pairs A and B plus a reader loop.
    // Every successful read must observe A/A or B/B, never a mixed pair.
}

func TestSlowStartDoesNotBlockExistingSessionTouch(t *testing.T) {
    // Block runtime.Start for user-2. Touch user-1 must complete before Start is released.
}

func TestConcurrentStartsReserveCapacityAndEnforcePerOwnerQuota(t *testing.T) {
    // Parallel starts must never exceed global max; second profile for one owner
    // must return ErrOwnerCapacity without calling runtime.Start.
}
```

- [ ] **Step 2: Verify RED with race detector**

Run: `go test -race ./internal/store ./internal/sessions`

Expected: mixed pair/race, blocked Touch timeout, or missing `MaxSessionsPerOwner` compile failure.

- [ ] **Step 3: Serialize filesystem pair operations**

```go
type FSStore struct { dir string; mu sync.RWMutex }

func (s *FSStore) Load(slug string) ([]byte, Meta, error) {
    s.mu.RLock(); defer s.mu.RUnlock()
    return s.loadUnlocked(slug)
}
```

Hold `mu.Lock()` for all of `Save` and `Delete`; hold one `RLock` for `List` and call `loadUnlocked` to avoid nested-reader starvation.

- [ ] **Step 4: Move Docker I/O outside global manager mutex**

```go
type Manager struct {
    mu sync.Mutex
    ownerLocks map[string]*sync.Mutex
    starting int
    startingByOwner map[string]int
    // existing fields
}
```

Serialize create/delete only per owner. Reserve global and owner capacity under `mu`, release `mu`, call runtime `Start/Alive/Stop`, then publish or roll back the reservation under `mu`. Reap and StopAll detach candidates under `mu`, stop outside it, and restore failed stops.

- [ ] **Step 5: Verify GREEN**

Run: `go test -race ./internal/store ./internal/sessions ./internal/api ./internal/proxy`

Expected: pass with zero race reports.

- [ ] **Step 6: Commit**

```bash
git add apps/kernel-server/internal/store apps/kernel-server/internal/sessions apps/kernel-server/internal/config/config.go apps/kernel-server/cmd/server/main.go
git commit -m "fix(kernel): serialize persistence and session admission"
```

---

### Task 3: Remove query-string tickets and isolate Docker control

**Files:**

- Modify: `apps/kernel-server/internal/proxy/ticket.go`
- Modify: `apps/kernel-server/internal/proxy/ticket_test.go`
- Modify: `apps/kernel-server/internal/proxy/jupyter.go`
- Modify: `apps/kernel-server/internal/proxy/jupyter_test.go`
- Modify: `apps/kernel-server/internal/api/handlers.go`
- Modify: `packages/core/src/notebook/kernel/session-client.ts`
- Modify: `packages/core/src/notebook/kernel/session-client.test.ts`
- Modify: `packages/core/src/notebook/kernel/jupyter-sandbox-adapter.ts`
- Create: `apps/kernel-server/cmd/docker-broker/main.go`
- Create: `apps/kernel-server/internal/broker/server.go`
- Create: `apps/kernel-server/internal/broker/server_test.go`
- Create: `apps/kernel-server/internal/runtime/broker.go`
- Create: `apps/kernel-server/internal/runtime/broker_test.go`
- Modify: `apps/kernel-server/Dockerfile`
- Modify: `apps/kernel-server/compose.yaml`
- Modify: `docs/onboarding/jupyter-sandbox.md`

**Interfaces:**

- Browser auth uses an HttpOnly `__Host-kernel-ticket` cookie scoped to `/api/sessions/{id}/jupyter/`; query parameters named `ticket` or `token` are rejected.
- `BrokerRuntime` calls a fixed internal broker API. Only broker mounts Docker socket; kernel-server image contains no Docker CLI and runs as UID 10001.

- [ ] **Step 1: Write failing cookie and broker policy tests**

```go
func TestProxyRejectsQueryTicketAndAcceptsScopedCookie(t *testing.T) {}
func TestSuccessfulProxyResponseRotatesFiveMinuteTicketCookie(t *testing.T) {}
func TestBrokerRejectsUnknownProfileAndIgnoresCallerDockerArguments(t *testing.T) {}
```

```ts
it("creates a credentialed session without putting its ticket in the Jupyter URL", async () => {
  const session = await client.create("data-science")
  expect(fetch).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ credentials: "include" })
  )
  expect(session.baseUrl).not.toMatch(/[?&](ticket|token)=/)
})
```

- [ ] **Step 2: Verify RED**

Run: `go test ./internal/proxy ./internal/broker ./internal/runtime` and `pnpm --filter @workspace/core test -- session-client.test.ts`.

Expected: query ticket is still accepted; broker packages do not exist; client still uses ticket query.

- [ ] **Step 3: Implement short-lived rotating cookie**

```go
const ticketLifetime = 5 * time.Minute
const ticketCookieName = "__Host-kernel-ticket"

func ticketCookie(sessionID, value string, expires time.Time) *http.Cookie {
    return &http.Cookie{Name: ticketCookieName, Value: value,
        Path: "/api/sessions/"+sessionID+"/jupyter/", HttpOnly: true,
        Secure: true, SameSite: http.SameSiteLaxMode, Expires: expires}
}
```

Issue cookie on authenticated session creation and rotate it on successful proxy HTTP/WS handshakes. Strip and reject query secrets. Add `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. Client fetches with credentials and constructs ticket-free base URLs.

- [ ] **Step 4: Implement fixed-policy Docker broker**

Broker accepts only `{sessionId, profile}` plus authenticated internal bearer token. It maps profile to configured image and applies hard-coded read-only rootfs, dropped capabilities, no-new-privileges, CPU, memory, PID, network, labels, and no bind mounts/host ports. Kernel `BrokerRuntime` can only start/stop/alive/reconcile labeled sessions. Compose mounts `/var/run/docker.sock` only into broker on an internal control network.

- [ ] **Step 5: Make both images non-root**

```dockerfile
RUN addgroup -g 10001 app && adduser -D -u 10001 -G app app
USER 10001:10001
```

- [ ] **Step 6: Verify GREEN**

Run: `go test -race ./...`, `go vet ./...`, `go build ./...`, and `pnpm --filter @workspace/core test`.

- [ ] **Step 7: Commit**

```bash
git add apps/kernel-server packages/core/src/notebook docs/onboarding/jupyter-sandbox.md
git commit -m "fix(kernel): replace bearer query tickets and isolate Docker control"
```

---

### Task 4: Enforce acyclic same-roadmap trees and cancellable saves

**Files:**

- Create: `apps/svc-api/src/roadmap/tree-invariants.ts`
- Create: `apps/svc-api/src/roadmap/tree-invariants.spec.ts`
- Create: `apps/svc-api/src/roadmap/roadmap.service.spec.ts`
- Modify: `apps/svc-api/src/roadmap/roadmap.service.ts`
- Create: `apps/svc-api/src/notion/notion.service.spec.ts`
- Modify: `apps/svc-api/src/notion/notion.service.ts`

**Interfaces:**

- `assertAcyclicTree(nodes: readonly TreeNodeRef[]): void` rejects duplicate IDs, dangling parents, self-parent, and cycles.
- `saveRoadmap` uses Prisma interactive transaction `{ timeout: 10_000, isolationLevel: "Serializable" }`; no `Promise.race` remains.

- [ ] **Step 1: Write failing pure and service tests**

```ts
it.each([
  [[{ id: "a", parentId: "a" }], "self"],
  [
    [
      { id: "a", parentId: "b" },
      { id: "b", parentId: "a" },
    ],
    "cycle",
  ],
  [[{ id: "a", parentId: "missing" }], "dangling"],
])("rejects invalid forest %s", (nodes) =>
  expect(() => assertAcyclicTree(nodes)).toThrow()
)

it("rejects a parent from another roadmap before update", async () => {})
it("rejects save nodes that do not belong to the route roadmap", async () => {})
it("passes Prisma timeout and Serializable options instead of racing an uncancelled promise", async () => {})
it("serializes opposing notion moves and uses cycle-safe recursive SQL", async () => {})
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter svc-api test -- tree-invariants.spec.ts roadmap.service.spec.ts notion.service.spec.ts`.

Expected: missing helper and current service accepts cross-roadmap/cyclic inputs.

- [ ] **Step 3: Implement tree invariant helper**

```ts
export function assertAcyclicTree(nodes: readonly TreeNodeRef[]): void {
  const parents = new Map(nodes.map((node) => [node.id, node.parentId]))
  if (parents.size !== nodes.length) throw new RoadmapError("INVALID_TREE")
  for (const node of nodes) {
    const seen = new Set<string>([node.id])
    let parent = node.parentId
    while (parent) {
      if (!parents.has(parent) || seen.has(parent))
        throw new RoadmapError("INVALID_TREE")
      seen.add(parent)
      parent = parents.get(parent) ?? null
    }
  }
}
```

- [ ] **Step 4: Apply invariant inside transactions**

For create/update, fetch parent with `{id, roadmapId, isDeleted}` and reject a roadmap mismatch. For parent changes, read the target roadmap forest, apply the proposed edge in memory, and call `assertAcyclicTree`. For batch save, load all nodes for `roadmapId`, reject any input ID not in that set, apply every proposed edge, validate once, then update.

Use a visited set in `subtreeOf` as defense against legacy corruption. Convert Prisma timeout code `P2028` to `RoadmapError("TIMEOUT")`.

- [ ] **Step 5: Serialize Notion moves**

Run move entirely inside a Serializable transaction, acquire `pg_advisory_xact_lock(hashtext('notion-document-tree'))`, use recursive CTE `UNION` instead of `UNION ALL`, check subtree and parent, count, then update through the transaction client.

- [ ] **Step 6: Verify GREEN**

Run: `pnpm --filter svc-api test` and `pnpm --filter svc-api typecheck`.

- [ ] **Step 7: Commit**

```bash
git add apps/svc-api/src/roadmap apps/svc-api/src/notion
git commit -m "fix(api): enforce transactional tree integrity"
```

---

### Task 5: Runtime DTO validation, fail-closed config, durable SSE

**Files:**

- Modify: `apps/svc-api/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/svc-api/src/bootstrap.ts`
- Create: `apps/svc-api/src/bootstrap.spec.ts`
- Modify: `apps/svc-api/src/main.ts`
- Modify: `apps/svc-api/src/serverless.ts`
- Modify: `apps/svc-api/src/roadmap/dto.ts`
- Modify: `apps/svc-api/src/notion/dto.ts`
- Create: `apps/svc-api/src/roadmap/dto.spec.ts`
- Modify: `packages/db/prisma/schema.prisma`
- Modify: `apps/svc-api/src/sse/roadmap-events.service.ts`
- Modify: `apps/svc-api/src/sse/sse.controller.ts`
- Create: `apps/svc-api/src/sse/roadmap-events.service.spec.ts`
- Modify: `packages/core/src/roadmap/api/service-selector.ts`
- Create: `packages/core/src/roadmap/api/service-selector.test.ts`

**Interfaces:**

- Shared `configureHttpApp(app, env)` installs `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` and fail-closed CORS.
- `RoadmapUpdateEvent` Prisma model persists events; `RoadmapEventsService.stream(roadmapId?)` polls by cursor so multiple instances observe writes.
- Production import of `service-selector` throws when backend URL is absent; development/test retains mock fallback.

- [ ] **Step 1: Install and test validation dependencies**

Run: `pnpm --filter svc-api add class-transformer class-validator`.

Write DTO tests using `validate()` for empty titles, invalid enum/status, non-HTTP URL, NaN coordinates, oversized arrays/strings, unknown keys, and valid bodies.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter svc-api test -- dto.spec.ts bootstrap.spec.ts roadmap-events.service.spec.ts` and `pnpm --filter @workspace/core test -- service-selector.test.ts`.

Expected: invalid DTOs have zero errors, production CORS allows empty origins, SSE cannot cross instances, production selector falls back to localStorage.

- [ ] **Step 3: Configure global validation and CORS once**

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  })
)
```

Production with empty `FRONTEND_ORIGINS` must reject browser origins. Development keeps explicit localhost defaults. Both `main.ts` and `serverless.ts` call the same helper.

- [ ] **Step 4: Add durable event table and polling stream**

```prisma
model RoadmapUpdateEvent {
  id        String   @id @default(cuid())
  roadmapId String
  createdAt DateTime @default(now())
  @@index([roadmapId, createdAt])
}
```

`emit` awaits `roadmapUpdateEvent.create`; `stream` uses RxJS `timer(0, 300)`, queries rows newer than its cursor, emits ordered signals, and removes rows older than 24 hours best-effort. Update every roadmap mutation to `await this.events.emit(...)`.

- [ ] **Step 5: Fail closed on missing production backend**

```ts
if (process.env.NODE_ENV === "production" && !roadmapBackendEnabled()) {
  throw new Error("NEXT_PUBLIC_SVC_API_URL is required in production")
}
```

- [ ] **Step 6: Verify GREEN and regenerate Prisma client**

Run: `pnpm --filter @workspace/db prisma:generate`, `pnpm --filter svc-api test`, `pnpm --filter @workspace/core test`, and both package typechecks.

- [ ] **Step 7: Commit**

```bash
git add apps/svc-api packages/db/prisma/schema.prisma packages/core/src/roadmap/api pnpm-lock.yaml
git commit -m "fix(platform): validate inputs and persist update events"
```

---

### Task 6: Protect super-admin changes, uploads, and Notion privacy

**Files:**

- Read before editing: installed Next.js 16.2.6 route-handler documentation.
- Create: `apps/super-admin/app/api/users/[id]/role/policy.ts`
- Create: `apps/super-admin/app/api/users/[id]/role/policy.test.ts`
- Modify: `apps/super-admin/app/api/users/[id]/role/route.ts`
- Create: `apps/admin/app/notion/upload-policy.ts`
- Create: `apps/admin/app/notion/upload-policy.test.ts`
- Modify: `apps/admin/app/notion/actions.ts`
- Modify: `apps/svc-api/src/notion/notion.service.ts`
- Modify: `apps/svc-api/src/notion/dto.ts`
- Modify: `apps/svc-api/src/schema.graphql`
- Modify: `packages/core/src/notion/types.ts`
- Modify: `packages/core/src/notion/api/notion.api.ts`

**Interfaces:**

- Role policy forbids self-demotion and demotion of the last super-admin; successful changes revoke target sessions and emit a structured audit log.
- Upload policy allows PNG, JPEG, WebP, GIF, PDF and UTF-8 text only; rejects SVG/HTML/executable/archive types; sanitizes filename.
- Public `NotionDoc` no longer exposes Clerk `authorId`.

- [ ] **Step 1: Write failing policy/privacy tests**

```ts
it("forbids self demotion", () =>
  expect(
    validateRoleChange({
      actorId: "u1",
      targetId: "u1",
      currentRole: "super-admin",
      nextRole: "admin",
      superAdminCount: 2,
    })
  ).toEqual({ ok: false, code: "SELF_DEMOTION" }))
it("forbids demoting the last super-admin", () => {})
it.each([
  "image/svg+xml",
  "text/html",
  "application/x-msdownload",
  "application/zip",
])("rejects %s", (type) => {})
it("omits authorId from viewer notion responses", async () => {})
```

- [ ] **Step 2: Verify RED**

Run targeted Vitest files; expected missing policy modules and leaked `authorId`.

- [ ] **Step 3: Implement policies**

Read target user before update, page through Clerk users to count current super-admins, apply pure policy, update metadata, revoke all target sessions, and log JSON containing event, actorId, targetId, oldRole, newRole, timestamp. Never log tokens.

Validate file size/type before `put`, replace filename with `sanitizeBaseName(file.name)`, and pass explicit `contentType`.

Remove `authorId` from public service/interface/GraphQL selections; keep database `authorId` for ownership/audit writes.

- [ ] **Step 4: Verify GREEN**

Run package tests, typechecks, and production builds for admin/super-admin/svc-api/core.

- [ ] **Step 5: Commit**

```bash
git add apps/super-admin/app/api/users apps/admin/app/notion apps/svc-api/src/notion apps/svc-api/src/schema.graphql packages/core/src/notion
git commit -m "fix(admin): guard privileged changes and public content"
```

---

### Task 7: CI and release gates for every service

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/deploy-staging.yml`
- Modify: `.github/workflows/release.yml`
- Create: `.github/workflows/kernel-image.yml`
- Modify: `docs/onboarding/jupyter-sandbox.md`

**Interfaces:**

- CI runs Go race tests, vet, and build in addition to pnpm gates.
- Vercel deployment matrix includes `svc-api`.
- Kernel image workflow builds immutable GHCR tags and never deploys a floating tag.
- Vercel CLI uses one reviewed exact version, not `@latest`.

- [ ] **Step 1: Write workflow assertions**

Use a Vitest YAML-text test or PowerShell verification script that asserts Go gates, `SVC_API`, exact Vercel version, GHCR digest/tag, and workflow permissions.

- [ ] **Step 2: Verify RED**

Run workflow assertion; expected missing Go gates/backend legs and `@latest` matches.

- [ ] **Step 3: Update workflows**

Add `actions/setup-go@v5` with version from `apps/kernel-server/go.mod`; run `go test -race ./...`, `go vet ./...`, `go build ./...`. Add svc-api Vercel project matrix leg. Pin Vercel CLI exact version. Build/push kernel-server to GHCR for tags and manual dispatch with `packages: write`, provenance and immutable `${{ github.sha }}` tag.

- [ ] **Step 4: Verify GREEN**

Run workflow assertion plus `actionlint` if available; inspect YAML with `git diff --check`.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows docs/onboarding/jupyter-sandbox.md
git commit -m "ci: gate and package backend services"
```

---

### Task 8: Full verification and video evidence

**Files:**

- Create: `.gstack/qa-reports/qa-report-localhost-2026-07-16.md`
- Create: `.gstack/qa-reports/baseline.json`
- Create: `.gstack/qa-reports/screenshots/*.png`
- Create: `.gstack/qa-reports/stability-evidence.webm`
- Create: `docs/security/2026-07-16-hardening-verification.md`

**Interfaces:**

- Report maps every audit item to source, automated test, runtime evidence, and residual risk.
- Video shows web roadmap navigation, admin roadmap load/edit validation, kernel health/session authorization, and zero browser console errors for tested pages.

- [ ] **Step 1: Run full fresh verification**

```text
pnpm lint
pnpm typecheck
pnpm test --force
pnpm build
cd apps/kernel-server && go test -race ./... && go vet ./... && go build ./...
git diff --check
git status --short
```

- [ ] **Step 2: Start local services with explicit development configuration**

Run web/admin/super-admin and kernel-server on their documented ports. Use `APP_ENV=development`, explicit dev role, randomized local ticket/broker secrets, and localhost-only origins. Do not copy production secrets into evidence.

- [ ] **Step 3: Execute browser QA and record video**

Use the `qa` browser workflow in diff-aware mode. Capture annotated screenshots before/after core interactions, inspect console after every interaction, test desktop and 375x812 mobile layouts, and record the full stable flow to `.gstack/qa-reports/stability-evidence.webm`.

- [ ] **Step 4: Write requirement-by-requirement verification report**

For each P1/P2 finding, record status, exact source/test, command output, and whether browser evidence applies. Any unverified item remains incomplete; do not mark the goal done.

- [ ] **Step 5: Final commit**

```bash
git add .gstack/qa-reports docs/security/2026-07-16-hardening-verification.md docs/superpowers/plans/2026-07-16-security-hardening-stability-evidence.md
git commit -m "docs: add security verification and stability evidence"
```

## Self-Review

- Spec coverage: all reported P1/P2 items map to Tasks 1-7; automated, runtime, and video evidence map to Task 8.
- Placeholder scan: every task step contains concrete code, commands, expected RED/GREEN output, and a commit boundary.
- Type consistency: `MaxSessionsPerOwner`, `RoadmapUpdateEvent`, `assertAcyclicTree`, `Config.Validate`, ticket cookie, and broker interfaces are defined before downstream use.
- Known external gate: actual production deployment of the GHCR kernel image requires a host/provider and secrets not present in the repository. This plan proves a deployable immutable artifact and documents the remaining operator action without claiming production deployment occurred.
