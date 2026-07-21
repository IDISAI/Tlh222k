# Jupyter Notebook End-to-End Implementation Plan

> ✅ **DONE (2026-07-15).** Notebooks live in production via Pyodide client-side (no kernel-server required for prod). Committed `.ipynb` fixtures + `outputFileTracingIncludes`; ungated read path; Pyodide adapter in `packages/core/src/notebook/kernel/pyodide`. Kiro sandbox (kernel-server) is a dev/future feature. **Đừng implement lại plan này.**

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver internal, sandboxed Jupyter execution for every roadmap Jupyter article across web, admin, and super-admin, with a free-tier Docker deployment profile.

**Architecture:** `@workspace/core` owns notebook UI and a `JupyterSandboxAdapter`; all three Next.js apps pass a Clerk token and render the same core feature. `apps/kernel-server` authenticates the user, owns the session-to-container mapping, enforces quota, and proxies Jupyter HTTP/WebSocket traffic to a per-user container on a Docker internal network. The browser receives only a short-lived proxy ticket, never the Jupyter token or container endpoint.

**Tech Stack:** Next.js 16.2.6, React 19, TypeScript, Clerk, `@jupyterlab/services`, Go 1.26, `nhooyr.io/websocket`, Docker Compose, Jupyter Server, Python 3.12, Vitest, Go `testing`.

## Global Constraints

- Node is `>=20`; pnpm is `10.33.4`; workspace package scope is `@workspace/*`.
- Read the applicable installed Next.js 16.2.6 documentation before editing a Next.js app route, client boundary, or configuration.
- Packages never import apps. Keep shared UI, notebook types, adapters, and hooks in `packages/core`.
- Preserve unrelated staged and unstaged work. Every commit below uses explicit paths, never `git add .`.
- All `articleType: "jupyter"` roadmap articles route internally: web to `/learn/[slug]`; admin and super-admin to `/notebooks/[slug]`. Ignore `jupyterUrl` for Jupyter navigation.
- Jupyter execution requires an authenticated Clerk subject. Published notebook reading remains public.
- Free-tier limits are exact defaults: two active sessions globally, `1` CPU, `2GiB` RAM, `128` PIDs, and 15 minutes idle expiry. Do not queue excess sessions.
- Sandbox images are immutable; no host mounts, public Jupyter ports, privilege escalation, package installation, or outbound internet from a sandbox.
- Notebook source and metadata persist; runtime filesystem and client execution output are ephemeral.
- Add `@jupyterlab/services` and `nhooyr.io/websocket` only for the declared Jupyter protocol/proxy responsibility. Do not add other runtime frameworks.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `packages/core/src/roadmap/utils/resolve-article-target.ts` | Internal-only Jupyter article target rule. |
| `packages/core/src/notebook/kernel/jupyter-sandbox-adapter.ts` | `KernelAdapter` implementation over kernel-server's Jupyter proxy. |
| `packages/core/src/notebook/kernel/session-client.ts` | Typed REST client for session lifecycle and proxy ticket refresh. |
| `packages/core/src/notebook/runtime/use-notebook-runtime.ts` | React state for per-cell source, outputs, running state, and session controls. |
| `packages/core/src/notebook/runtime/components/InteractiveNotebook.tsx` | Reusable tutorial/editor execution surface. |
| `packages/core/src/notebook/editor/*` | Authoring, publish/profile metadata, and execution controls. |
| `apps/*/app/notebooks/**` | Authenticated zone adapters and notebook index/editor pages. |
| `apps/web/app/learn/[slug]/learn-client.tsx` | Web viewer/exercise integration with Clerk and the shared runtime. |
| `apps/kernel-server/internal/auth` | Principal (`subject`, role, authenticated) parsed from Clerk JWT. |
| `apps/kernel-server/internal/sessions` | Ownership, quota, ticket, lifecycle, and idle expiry. |
| `apps/kernel-server/internal/runtime` | Docker CLI-backed, testable container runtime implementation. |
| `apps/kernel-server/internal/proxy` | Authenticated Jupyter HTTP and binary WebSocket relay. |
| `apps/kernel-server/compose.yaml` and `runtime/` | Local/OCI Compose stack and locked-down runtime images. |
| `docs/onboarding/` and `apps/kernel-server/README.md` | Environment and OCI deployment instructions. |

### Task 1: Add a repeatable test boundary and force internal Jupyter routing

**Files:**
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/roadmap/utils/resolve-article-target.test.ts`
- Modify: `packages/core/package.json`
- Modify: `packages/core/src/roadmap/utils/resolve-article-target.ts`
- Modify: `packages/core/src/roadmap/builder/components/NodeDetailDialog.tsx`
- Modify: `packages/core/src/roadmap/builder/components/NodeEditPanel.tsx`
- Modify: `packages/core/src/roadmap/builder/components/BuilderNodeComponent.tsx`
- Modify: `packages/core/src/roadmap/builder/components/HoverPreview.tsx`
- Modify: `packages/core/src/roadmap/graph/components/RoadmapNodeComponent.tsx`

**Interfaces:**
- Consumes: `RoadmapNode`, `ArticleTarget`, and `nodeNavigationUrl()`.
- Produces: `resolveArticleTarget(node)` returns `{ kind: "internal", slug }` for every Jupyter article, regardless of `jupyterUrl`.

- [ ] **Step 1: Add Vitest and the failing routing tests.**

  Add this script and dev dependency to `packages/core/package.json`:

  ```json
  "scripts": {
    "lint": "eslint",
    "format": "prettier --write \"**/*.{ts,tsx}\"",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "jsdom": "^26.1.0",
    "vitest": "^3.2.4"
  }
  ```

  Create `vitest.config.ts` with `defineConfig({ test: { environment: "jsdom", include: ["src/**/*.test.{ts,tsx}"] } })`, then create this test shape:

  ```ts
  it("keeps a Jupyter article internal even when legacy jupyterUrl is absolute", () => {
    expect(resolveArticleTarget(node({ articleType: "jupyter", jupyterUrl: "https://colab.research.google.com/x" })))
      .toEqual({ kind: "internal", slug: "numpy-basics" })
  })

  it("keeps Notion links external", () => {
    expect(resolveArticleTarget(node({ articleType: "notion", notionPageId: "page-id" })))
      .toEqual({ kind: "external", url: "https://notion.so/page-id" })
  })
  ```

- [ ] **Step 2: Run the test before the rule change.**

  Run: `pnpm --filter @workspace/core test -- resolve-article-target.test.ts`

  Expected: the Jupyter absolute-URL assertion fails because the current target is external.

- [ ] **Step 3: Implement the routing rule and remove misleading external-Jupyter UI.**

  Replace the Jupyter branch with:

  ```ts
  if (node.articleType === "jupyter") {
    return { kind: "internal", slug: node.slug }
  }
  ```

  Keep absolute URL handling only for Notion targets. Update `NodeDetailDialog` comments and labels so a Jupyter article always uses `notebookBasePath`; retain external-tab behavior exclusively for Notion. Remove the `jupyterUrl` input from `NodeEditPanel` and save `jupyterUrl: ""` whenever `articleType === "jupyter"`, while leaving the database field intact for backwards compatibility. Treat every Jupyter article as linked in `BuilderNodeComponent` and `RoadmapNodeComponent`, and make `HoverPreview` display `Internal notebook: /learn/[slug]` rather than any `jupyterUrl`.

- [ ] **Step 4: Verify routing and type safety.**

  Run: `pnpm --filter @workspace/core test -- resolve-article-target.test.ts`

  Expected: PASS, including absolute legacy URL cases.

  Run: `pnpm --filter @workspace/core typecheck`

  Expected: exit code 0.

- [ ] **Step 5: Commit the isolated routing deliverable.**

  ```bash
  git add pnpm-lock.yaml packages/core/package.json packages/core/vitest.config.ts packages/core/src/roadmap/utils/resolve-article-target.ts packages/core/src/roadmap/utils/resolve-article-target.test.ts packages/core/src/roadmap/builder/components/NodeDetailDialog.tsx packages/core/src/roadmap/builder/components/NodeEditPanel.tsx packages/core/src/roadmap/builder/components/BuilderNodeComponent.tsx packages/core/src/roadmap/builder/components/HoverPreview.tsx packages/core/src/roadmap/graph/components/RoadmapNodeComponent.tsx
  git commit -m "feat: route Jupyter articles to internal notebooks"
  ```

### Task 2: Define notebook metadata, session contracts, and persistence semantics

**Files:**
- Create: `packages/core/src/notebook/kernel/session-client.ts`
- Create: `packages/core/src/notebook/kernel/session-client.test.ts`
- Modify: `packages/core/src/notebook/kernel/types.ts`
- Modify: `packages/core/src/notebook/editor/store.ts`
- Modify: `packages/core/src/notebook/editor/editor.service.ts`
- Modify: `packages/core/src/notebook/editor/hooks/useNotebookEditor.ts`
- Modify: `packages/core/src/notebook/editor/components/NotebookEditor.tsx`
- Modify: `packages/core/src/notebook/index.ts`
- Modify: `apps/kernel-server/internal/store/store.go`
- Modify: `apps/kernel-server/internal/api/handlers.go`
- Create: `apps/kernel-server/internal/store/store_test.go`

**Interfaces:**
- Consumes: existing `Notebook`, `RawNotebook`, kernel-server notebook CRUD JSON.
- Produces: `RuntimeProfile`, `NotebookMeta`, `NotebookRecord`, `SandboxSession`, and a stable `NotebookStore` API that preserves `published` and `runtimeProfile`.

- [ ] **Step 1: Write failing type-level/client tests and Go store tests.**

  Add a session-client test using a mocked `fetch` that expects:

  ```ts
  await client.create("data-science")
  expect(fetch).toHaveBeenCalledWith(
    "https://kernel.example/api/sessions",
    expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer clerk" }) })
  )
  ```

  Add `TestFSStorePersistsRuntimeProfile` that saves metadata and confirms `Load` returns `RuntimeProfile: "ml-cpu"`.

- [ ] **Step 2: Run the focused tests to prove the contracts do not exist.**

  Run: `pnpm --filter @workspace/core test -- session-client.test.ts`

  Expected: FAIL because `SandboxSessionClient` is undefined.

  Run: `go test ./internal/store -run TestFSStorePersistsRuntimeProfile -count=1`

  Working directory: `apps/kernel-server`

  Expected: FAIL because `Meta.RuntimeProfile` is absent.

- [ ] **Step 3: Implement the shared contracts.**

  Add these exact domain shapes to `kernel/types.ts`:

  ```ts
  export type RuntimeProfile = "data-science" | "ml-cpu"
  export interface SandboxSession {
    id: string
    profile: RuntimeProfile
    status: KernelStatus
    proxyBaseUrl: string
    connectionTicket: string
    expiresAt: string
  }
  export interface NotebookMeta {
    published: boolean
    runtimeProfile: RuntimeProfile
    updatedAt: string
  }
  export interface NotebookRecord { notebook: Notebook; meta: NotebookMeta }
  ```

  Make `NotebookStore.load()` return `NotebookRecord | null` and `save(slug, record)` preserve `published` and profile rather than hardcoding publication. Add `RuntimeProfile string` to Go `store.Meta`, validate it against the two values on `PUT`, and include it in each CRUD response. `SandboxSessionClient` must expose `create(profile)`, `get(id)`, `interrupt(id)`, `restart(id)`, and `remove(id)`; every request obtains a fresh Clerk token through its injected callback.

- [ ] **Step 4: Run tests and package checks.**

  Run: `pnpm --filter @workspace/core test -- session-client.test.ts`

  Expected: PASS.

  Run: `go test ./internal/store -count=1`

  Expected: PASS.

  Run: `pnpm --filter @workspace/core typecheck`

  Expected: exit code 0 after all store consumers use `NotebookRecord`.

- [ ] **Step 5: Commit the persistence contract.**

  ```bash
  git add packages/core/src/notebook/kernel packages/core/src/notebook/editor/store.ts packages/core/src/notebook/editor/editor.service.ts packages/core/src/notebook/editor/hooks/useNotebookEditor.ts packages/core/src/notebook/editor/components/NotebookEditor.tsx packages/core/src/notebook/index.ts apps/kernel-server/internal/store apps/kernel-server/internal/api/handlers.go
  git commit -m "feat: add notebook runtime metadata contracts"
  ```

### Task 3: Add authenticated principals and a testable sandbox session manager

**Files:**
- Create: `apps/kernel-server/internal/sessions/types.go`
- Create: `apps/kernel-server/internal/sessions/manager.go`
- Create: `apps/kernel-server/internal/sessions/manager_test.go`
- Modify: `apps/kernel-server/internal/auth/auth.go`
- Modify: `apps/kernel-server/internal/config/config.go`
- Modify: `apps/kernel-server/cmd/server/main.go`

**Interfaces:**
- Consumes: verified Clerk claims (`sub`, role), configured quota, and a future `runtime.Runtime`.
- Produces: `auth.PrincipalFrom(*http.Request)`, `auth.RequireAuthenticated`, `sessions.Manager`, and session ownership enforcement independent of HTTP.

- [ ] **Step 1: Write failing manager tests with a fake runtime.**

  Use this fake and assertions in `manager_test.go`:

  ```go
  type fakeRuntime struct{ starts, stops int }
  func (f *fakeRuntime) Start(context.Context, sessions.StartRequest) (sessions.RuntimeHandle, error) { f.starts++; return sessions.RuntimeHandle{ID: "ctr-1", Endpoint: "http://nb-1:8888", Token: "jupyter"}, nil }
  func (f *fakeRuntime) Stop(context.Context, string) error { f.stops++; return nil }

  func TestCreateRejectsThirdActiveSession(t *testing.T) { /* max=2; third returns sessions.ErrCapacity */ }
  func TestGetRejectsDifferentOwner(t *testing.T) { /* ErrForbidden */ }
  func TestReapIdleStopsRuntime(t *testing.T) { /* advance injected clock; fake.stops == 1 */ }
  ```

- [ ] **Step 2: Run the manager test before implementation.**

  Run: `go test ./internal/sessions -count=1`

  Working directory: `apps/kernel-server`

  Expected: FAIL because the package does not exist.

- [ ] **Step 3: Implement principal extraction and lifecycle ownership.**

  Replace role-only request context with:

  ```go
  type Principal struct { Subject string; Role Role; Authenticated bool }
  func PrincipalFrom(r *http.Request) Principal
  func RequireAuthenticated(next http.HandlerFunc) http.HandlerFunc
  ```

  `Authenticator.resolve` must derive `Subject` from JWT `sub`; in dev use a deterministic subject such as `dev:<role>`. Define `sessions.Session` with `ID`, `Owner`, `Profile`, `Handle`, `LastActivity`, `ExpiresAt`, and `Status`. `Manager.CreateOrResume` must lock the in-memory map, reuse the caller's active session of the requested profile, return `ErrCapacity` before calling runtime, and create a new session only after `Runtime.Start` succeeds. Add an injected `Clock` and `ReapExpired(ctx)` for deterministic expiry tests. In `main.go`, start a `time.NewTicker(time.Minute)` goroutine that calls `ReapExpired` until process shutdown.

  Parse these config defaults: `JUPYTER_MAX_SESSIONS=2`, `JUPYTER_SESSION_IDLE_SECONDS=900`, `JUPYTER_SESSION_CPU=1`, `JUPYTER_SESSION_MEMORY=2g`, `JUPYTER_SESSION_PIDS=128`, and `JUPYTER_DOCKER_NETWORK=notebook-internal`.

- [ ] **Step 4: Run the Go test suite.**

  Run: `go test ./internal/auth ./internal/sessions -count=1`

  Expected: PASS, including cross-owner rejection and idle cleanup.

  Run: `go vet ./...`

  Working directory: `apps/kernel-server`

  Expected: exit code 0.

- [ ] **Step 5: Commit the authorization and session boundary.**

  ```bash
  git add apps/kernel-server/internal/auth apps/kernel-server/internal/sessions apps/kernel-server/internal/config/config.go apps/kernel-server/cmd/server/main.go
  git commit -m "feat: manage owned notebook sandbox sessions"
  ```

### Task 4: Start locked-down per-user Jupyter containers

**Files:**
- Create: `apps/kernel-server/internal/runtime/runtime.go`
- Create: `apps/kernel-server/internal/runtime/docker.go`
- Create: `apps/kernel-server/internal/runtime/docker_test.go`
- Modify: `apps/kernel-server/cmd/server/main.go`
- Create: `apps/kernel-server/runtime/Dockerfile`
- Create: `apps/kernel-server/runtime/requirements-data-science.txt`
- Create: `apps/kernel-server/runtime/requirements-ml-cpu.txt`

**Interfaces:**
- Consumes: `sessions.StartRequest { SessionID, Profile, CPU, Memory, Pids, Network }`.
- Produces: `runtime.Runtime` with `Start` and `Stop`; session endpoint is an internal `http://<container-name>:8888` URL and token never leaves Go.

- [ ] **Step 1: Write the command-construction test before invoking Docker.**

  Inject a `CommandRunner` and assert the generated `docker run` arguments include:

  ```go
  "--detach", "--network", "notebook-internal", "--read-only",
  "--tmpfs", "/tmp:rw,noexec,nosuid,size=256m",
  "--tmpfs", "/home/jovyan:rw,nosuid,size=512m",
  "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
  "--pids-limit", "128", "--cpus", "1", "--memory", "2g",
  "--user", "1000:100", "--label", "notebook.session=session-1"
  ```

  Also assert neither `-v` nor `--publish` appears.

- [ ] **Step 2: Run the runtime test before implementation.**

  Run: `go test ./internal/runtime -count=1`

  Working directory: `apps/kernel-server`

  Expected: FAIL because the runtime package does not exist.

- [ ] **Step 3: Implement runtime images and Docker CLI runtime.**

  Define:

  ```go
  type Runtime interface {
    Start(ctx context.Context, request sessions.StartRequest) (sessions.RuntimeHandle, error)
    Stop(ctx context.Context, containerID string) error
  }
  ```

  `DockerRuntime.Start` must generate a cryptographically random Jupyter token, choose only the configured `data-science` or `ml-cpu` image, run the command through `exec.CommandContext`, and return the container DNS endpoint. `Stop` must use `docker rm --force <id>`. The Dockerfile must use a non-root Jupyter-compatible base, install the selected requirements during image build, copy the course grading shim, and start `jupyter server` on `8888` with the supplied token. Never mount the Docker socket or a volume into the spawned notebook image.

- [ ] **Step 4: Run isolated runtime checks.**

  Run: `go test ./internal/runtime -count=1`

  Expected: PASS.

  Run: `docker build -f runtime/Dockerfile --build-arg PROFILE=data-science -t local/notebook-data-science:dev .`

  Working directory: `apps/kernel-server`

  Expected: image builds successfully for the local architecture.

- [ ] **Step 5: Commit the sandbox runtime.**

  ```bash
  git add apps/kernel-server/internal/runtime apps/kernel-server/cmd/server/main.go apps/kernel-server/runtime
  git commit -m "feat: start constrained Jupyter runtime containers"
  ```

### Task 5: Expose the session API and authenticated Jupyter HTTP/WebSocket proxy

**Files:**
- Create: `apps/kernel-server/internal/proxy/ticket.go`
- Create: `apps/kernel-server/internal/proxy/ticket_test.go`
- Create: `apps/kernel-server/internal/proxy/jupyter.go`
- Create: `apps/kernel-server/internal/proxy/jupyter_test.go`
- Modify: `apps/kernel-server/internal/api/handlers.go`
- Modify: `apps/kernel-server/internal/httpx/cors.go`
- Modify: `apps/kernel-server/go.mod`
- Modify: `apps/kernel-server/cmd/server/main.go`

**Interfaces:**
- Consumes: authenticated `Principal`, `sessions.Manager`, per-session Jupyter endpoint/token.
- Produces: lifecycle routes, a short-lived signed `connectionTicket`, and `/api/sessions/{id}/jupyter/{path...}` HTTP/WS proxy routes.

- [ ] **Step 1: Write route, ticket, and relay tests.**

  Cover these cases:

  ```go
  func TestTicketRejectsWrongSessionAndExpiredSignature(t *testing.T) {}
  func TestSessionRouteReturns401WithoutPrincipal(t *testing.T) {}
  func TestSessionRouteReturns403ForDifferentOwner(t *testing.T) {}
  func TestProxyStripsClientTicketAndInjectsJupyterToken(t *testing.T) {}
  func TestWebSocketRelayPreservesBinaryMessage(t *testing.T) {}
  ```

  Make the upstream a local `httptest.Server`; inspect that it sees the server-held Jupyter `Authorization: token ...` header and never sees `ticket`.

- [ ] **Step 2: Run the tests before implementation.**

  Run: `go test ./internal/proxy ./internal/api -count=1`

  Working directory: `apps/kernel-server`

  Expected: FAIL because session and proxy routes are absent.

- [ ] **Step 3: Implement tickets, REST, and binary WebSocket proxying.**

  Add `nhooyr.io/websocket` in `go.mod`. Sign a base64url payload `{sessionID, subject, exp}` with `HMAC-SHA256(SESSION_TICKET_SECRET)`; tickets expire after five minutes and are checked against the current session owner. Add these routes, all behind `RequireAuthenticated`:

  ```text
  POST   /api/sessions
  GET    /api/sessions/{id}
  POST   /api/sessions/{id}/interrupt
  POST   /api/sessions/{id}/restart
  DELETE /api/sessions/{id}
  /api/sessions/{id}/jupyter/{path...}
  ```

  `POST /api/sessions` returns `{ id, profile, status, proxyBaseUrl, connectionTicket, expiresAt }`. The proxy validates the ticket, verifies owner again, rewrites the upstream URL, injects the internal Jupyter token, and updates activity. Relay WebSocket frames in both directions with their original `websocket.MessageType`; terminate both sides when either closes. Add `POST` to CORS allowed methods.

- [ ] **Step 4: Run API/proxy checks.**

  Run: `go test ./internal/api ./internal/proxy ./internal/sessions -count=1`

  Expected: PASS.

  Run: `go build ./...`

  Working directory: `apps/kernel-server`

  Expected: exit code 0.

- [ ] **Step 5: Commit the network boundary.**

  ```bash
  git add apps/kernel-server/go.mod apps/kernel-server/go.sum apps/kernel-server/internal/api apps/kernel-server/internal/proxy apps/kernel-server/internal/httpx/cors.go apps/kernel-server/cmd/server/main.go
  git commit -m "feat: proxy owned Jupyter sandbox sessions"
  ```

### Task 6: Implement the shared Jupyter adapter and interactive cell state

**Files:**
- Create: `packages/core/src/notebook/kernel/jupyter-sandbox-adapter.ts`
- Create: `packages/core/src/notebook/kernel/jupyter-sandbox-adapter.test.ts`
- Create: `packages/core/src/notebook/runtime/use-notebook-runtime.ts`
- Create: `packages/core/src/notebook/runtime/components/InteractiveCodeCell.tsx`
- Create: `packages/core/src/notebook/runtime/components/InteractiveNotebook.tsx`
- Create: `packages/core/src/notebook/runtime/index.ts`
- Modify: `packages/core/src/notebook/kernel/index.ts`
- Modify: `packages/core/src/notebook/index.ts`
- Modify: `packages/core/package.json`

**Interfaces:**
- Consumes: `SandboxSessionClient`, `KernelAdapter`, `NotebookCell`, and a caller-provided `getToken`.
- Produces: `JupyterSandboxAdapter`, `useNotebookRuntime`, and an interactive notebook surface reusable by tutorial, exercise, and editor.

- [ ] **Step 1: Add the failing adapter tests.**

  Mock `@jupyterlab/services` and assert that one execute request maps these IOPub messages to the existing output union:

  ```ts
  stream          -> { kind: "stream", name: "stdout", text }
  execute_result  -> { kind: "execute_result", executionCount, data }
  display_data    -> { kind: "display_data", data }
  error           -> { kind: "error", ename, evalue, traceback }
  ```

  Also assert `interrupt()` posts to `/interrupt`, `restart()` posts to `/restart`, and the adapter never exposes the Jupyter token.

- [ ] **Step 2: Run adapter tests before implementation.**

  Run: `pnpm --filter @workspace/core test -- jupyter-sandbox-adapter.test.ts`

  Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Add the adapter and generic interactive runtime.**

  Add `@jupyterlab/services` to `packages/core` dependencies. Configure `ServerConnection.makeSettings` with the session's `proxyBaseUrl` and `connectionTicket`; it must only talk to kernel-server paths. Implement `execute(code, callbacks)` by subscribing to IOPub, translating Jupyter mime bundles to `CellOutput`, resolving on shell reply, and always disposing listeners. `useNotebookRuntime` owns `{ source, outputs, executionCount, running }` per code-cell id plus `runCell`, sequential `runAll`, `interrupt`, and `restart`. `InteractiveCodeCell` uses the existing `CodeCellEditor` and `OutputRenderer`; it disables concurrent runs and renders `In [*]` while busy.

- [ ] **Step 4: Verify the core execution contract.**

  Run: `pnpm --filter @workspace/core test -- jupyter-sandbox-adapter.test.ts`

  Expected: PASS.

  Run: `pnpm --filter @workspace/core lint && pnpm --filter @workspace/core typecheck`

  Expected: both exit code 0.

- [ ] **Step 5: Commit shared execution UI.**

  ```bash
  git add packages/core/package.json packages/core/src/notebook/kernel packages/core/src/notebook/runtime packages/core/src/notebook/index.ts
  git commit -m "feat: add shared Jupyter notebook runtime adapter"
  ```

### Task 7: Integrate web tutorial, exercise grading, and roadmap progress

**Files:**
- Modify: `apps/web/app/learn/[slug]/learn-client.tsx`
- Modify: `apps/web/app/learn/[slug]/page.tsx`
- Delete: `apps/web/app/learn/[slug]/pyodide.worker.ts`
- Delete: `apps/web/app/learn/[slug]/learntools.ts`
- Modify: `packages/core/src/notebook/viewer/components/NotebookView.tsx`
- Modify: `packages/core/src/notebook/viewer/components/CellRenderer.tsx`
- Modify: `packages/core/src/notebook/exercise/components/ExerciseView.tsx`
- Modify: `packages/core/src/notebook/exercise/exercise.service.ts`
- Modify: `packages/core/src/roadmap/api/roadmap.api.ts`
- Modify: `apps/svc-roadmap/src/roadmap/roadmap.service.ts`
- Modify: `apps/svc-roadmap/src/roadmap/roadmap.controller.ts`
- Modify: `apps/svc-roadmap/src/roadmap/dto.ts`
- Create: `packages/core/src/notebook/exercise/exercise.service.test.ts`

**Interfaces:**
- Consumes: `InteractiveNotebook`, `JupyterSandboxAdapter`, Clerk `useAuth().getToken`, and `RoadmapApi.setNodeStatus(nodeId, status)`.
- Produces: signed-in remote execution for tutorial/exercise; anonymous read-only view; exercise completion updates existing `UserProgress`.

- [ ] **Step 1: Write exercise/progress tests.**

  Add tests proving `computeProgress(["q1", "q2"], { q1: "correct" })` does not complete, while both correct does. Test a new `exerciseNodeStatus(progress)` helper returns `"in_progress"` after the first run and `"done"` only when `correct === total && total > 0`.

- [ ] **Step 2: Run the failing exercise test.**

  Run: `pnpm --filter @workspace/core test -- exercise.service.test.ts`

  Expected: FAIL because `exerciseNodeStatus` is absent.

- [ ] **Step 3: Replace Pyodide integration with the remote feature.**

  In `LearnClient`, call Clerk `useAuth`, construct `SandboxSessionClient` with `NEXT_PUBLIC_KERNEL_SERVER_URL`, and pass a token getter to the shared runtime. Render `NotebookView` with interactive code cells on the Tutorial tab. On Run, show a sign-in CTA if no user/session; otherwise allocate a sandbox. Refactor `ExerciseView` to consume the same runtime instead of `createWorker`, preserving `qN.check()` grade chips. Add `PATCH /api/roadmaps/nodes/by-slug/{slug}/notebook-status` in `svc-roadmap`; it resolves the node server-side, requires an authenticated user, rejects non-Jupyter nodes, and delegates to the existing `setNodeStatus`. Expose `RoadmapApi.setNotebookStatus(slug, status)` so the browser never submits a raw node id. Remove the Pyodide worker and learntools shim only after all imports are gone.

- [ ] **Step 4: Verify browser-facing logic.**

  Run: `pnpm --filter @workspace/core test -- exercise.service.test.ts`

  Expected: PASS.

  Run: `pnpm --filter web typecheck && pnpm --filter @workspace/core typecheck`

  Expected: exit code 0.

- [ ] **Step 5: Commit web runtime integration.**

  ```bash
  git add apps/web/app/learn/[slug]/learn-client.tsx apps/web/app/learn/[slug]/pyodide.worker.ts apps/web/app/learn/[slug]/learntools.ts packages/core/src/notebook/viewer/components/NotebookView.tsx packages/core/src/notebook/exercise packages/core/src/roadmap/api/roadmap.api.ts
  git commit -m "feat: run web notebooks in sandbox sessions"
  ```

### Task 8: Finish authoring, publishing, and admin/super-admin parity

**Files:**
- Create: `packages/core/src/notebook/editor/components/NotebookIndex.tsx`
- Create: `apps/admin/app/notebooks/page.tsx`
- Create: `apps/admin/app/notebooks/[slug]/notebook-editor-client.tsx`
- Modify: `apps/admin/app/notebooks/[slug]/page.tsx`
- Create: `apps/super-admin/app/notebooks/page.tsx`
- Create: `apps/super-admin/app/notebooks/[slug]/page.tsx`
- Create: `apps/super-admin/app/notebooks/[slug]/notebook-editor-client.tsx`
- Create: `apps/super-admin/app/roadmap/[slug]/page.tsx`
- Modify: `apps/admin/lib/paths.ts`
- Modify: `apps/super-admin/lib/paths.ts`
- Modify: `apps/admin/app/layout.tsx`
- Modify: `apps/super-admin/app/layout.tsx`
- Modify: `packages/core/src/notebook/editor/components/NotebookEditor.tsx`
- Modify: `packages/core/src/notebook/editor/components/EditorToolbar.tsx`
- Modify: `packages/core/src/notebook/editor/components/EditableCell.tsx`

**Interfaces:**
- Consumes: `NotebookStore` records, `InteractiveCodeCell`/runtime API, `getToken`, and `RuntimeProfile`.
- Produces: role-guarded notebook list/editor routes in both management zones and a working publish/profile/editor toolbar.

- [ ] **Step 1: Add component tests for author controls.**

  Test `NotebookIndex` renders a notebook's title, profile, and Published/Draft state, and that `NotebookEditor` sends `published: false` plus `runtimeProfile: "ml-cpu"` through `NotebookStore.save` after controls change.

- [ ] **Step 2: Run the authoring tests before implementation.**

  Run: `pnpm --filter @workspace/core test -- NotebookIndex`

  Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the zone adapters and editor controls.**

  Each `*-editor-client.tsx` must be a client component using `useAuth().getToken` and pass it to `NotebookEditor`; no Clerk package is imported into `packages/core`. Add a notebook list that creates a slug only after matching `^[a-z0-9][a-z0-9-]*$`. Add profile select, Draft/Published toggle, run cell/run all, interrupt, restart, and session-status pill to the core editor. `EditableCell` must replace its disabled Phase 3 Run button with the generic interactive control. Add direct super-admin notebook routes and a read-only super-admin roadmap route that passes `notebookBasePath="/notebooks"`. Link both management headers to their notebook index.

- [ ] **Step 4: Verify role-zone builds.**

  Run: `pnpm --filter @workspace/core test -- NotebookIndex`

  Expected: PASS.

  Run: `pnpm --filter admin typecheck && pnpm --filter super-admin typecheck`

  Expected: exit code 0.

- [ ] **Step 5: Commit authoring parity.**

  ```bash
  git add packages/core/src/notebook/editor apps/admin apps/super-admin
  git commit -m "feat: add notebook authoring to admin zones"
  ```

### Task 9: Package local Compose and OCI-ready documentation

**Files:**
- Create: `apps/kernel-server/Dockerfile`
- Create: `apps/kernel-server/compose.yaml`
- Modify: `apps/kernel-server/.env.example`
- Modify: `apps/kernel-server/README.md`
- Modify: `apps/kernel-server/AGENTS.md`
- Create: `docs/onboarding/jupyter-sandbox.md`
- Modify: `docs/onboarding/env.md`
- Modify: `apps/web/.env.example`
- Modify: `apps/admin/.env.example`
- Modify: `apps/super-admin/.env.example`

**Interfaces:**
- Consumes: configuration defined in Task 3 and runtime images from Task 4.
- Produces: a reproducible `docker compose up --build` environment with only kernel-server published on `3006` and explicit web-app environment variables.

- [ ] **Step 1: Add a Compose smoke script that fails without the stack.**

  Create a shell/PowerShell-independent Go integration test or documented curl sequence that expects these calls:

  ```text
  GET  /health                         -> 200
  POST /api/sessions (dev auth)        -> 201 with one connection ticket
  POST proxied /api/kernels            -> 201
  WS   proxied /api/kernels/:id/channels -> binary reply
  ```

  It must also assert `docker ps` exposes no `8888` host port.

- [ ] **Step 2: Run it before writing Compose.**

  Run: `docker compose -f compose.yaml up --build --wait`

  Working directory: `apps/kernel-server`

  Expected: FAIL because `compose.yaml` does not exist.

- [ ] **Step 3: Implement Compose and documented operational configuration.**

  Compose has a `kernel-server` service with the Docker socket mounted only into that trusted service, `ports: ["3006:3006"]`, an `internal: true` `notebook-internal` network, and persistent storage only for notebook metadata. The dynamic Jupyter containers join `notebook-internal` and have no host port or bind mount. Document `NEXT_PUBLIC_KERNEL_SERVER_URL`, `CLERK_JWKS_URL`, `SESSION_TICKET_SECRET`, all quota/image variables, production CORS origins, OCI firewall rule for HTTPS reverse proxy, ARM image build verification, and the exact warning that GPU/deep-training workloads exceed the free tier.

- [ ] **Step 4: Run Compose smoke and safety checks.**

  Run: `docker compose -f compose.yaml up --build --wait`

  Working directory: `apps/kernel-server`

  Expected: kernel-server healthy on `http://localhost:3006/health`.

  Run: `docker compose -f compose.yaml ps`

  Expected: only `3006` is published; no Jupyter `8888` mapping appears.

- [ ] **Step 5: Commit deployment assets and docs.**

  ```bash
  git add apps/kernel-server/Dockerfile apps/kernel-server/compose.yaml apps/kernel-server/.env.example apps/kernel-server/README.md apps/kernel-server/AGENTS.md apps/kernel-server/runtime docs/onboarding/jupyter-sandbox.md docs/onboarding/env.md apps/web/.env.example apps/admin/.env.example apps/super-admin/.env.example
  git commit -m "docs: add Jupyter sandbox deployment guide"
  ```

### Task 10: Run the complete verification matrix and document the handoff

**Files:**
- Modify: `docs/notebook-feature/prompt.md`
- Modify: `docs/superpowers/specs/2026-07-10-jupyter-notebook-end-to-end-design.md`
- Create: `docs/notebook-feature/verification.md`

**Interfaces:**
- Consumes: all completed feature paths.
- Produces: a reproducible manual and automated acceptance record; docs no longer call execution "Phase 3 not started".

- [ ] **Step 1: Write the verification matrix before final checks.**

  Add rows for anonymous read, anonymous Run sign-in prompt, owner execute, cross-owner 403, global capacity 429, interrupt/restart, idle reaping, exercise `in_progress`, exercise `done`, admin publish/unpublish, super-admin editor, Jupyter route ignoring an absolute `jupyterUrl`, and no public port/egress/host mount.

- [ ] **Step 2: Run targeted automated suites.**

  Run: `pnpm --filter @workspace/core test`

  Expected: PASS.

  Run: `go test ./... && go vet ./... && go build ./...`

  Working directory: `apps/kernel-server`

  Expected: all commands exit 0.

- [ ] **Step 3: Run repository CI-equivalent checks.**

  Run: `pnpm lint`

  Expected: exit code 0.

  Run: `pnpm typecheck`

  Expected: exit code 0.

  Run: `pnpm build`

  Expected: exit code 0.

- [ ] **Step 4: Perform manual browser smoke tests against Compose.**

  Start web/admin/super-admin with `NEXT_PUBLIC_KERNEL_SERVER_URL=http://localhost:3006` and `NEXT_PUBLIC_DEV_AUTH_ROLE=super-admin` where appropriate. Verify the ASCII flows in the approved design document one by one, capturing failures in `docs/notebook-feature/verification.md` with the request/response status and correction made.

- [ ] **Step 5: Commit verification/documentation and hand off.**

  ```bash
  git add docs/notebook-feature/prompt.md docs/notebook-feature/verification.md docs/superpowers/specs/2026-07-10-jupyter-notebook-end-to-end-design.md
  git commit -m "docs: verify end-to-end notebook sandbox flow"
  ```

## Plan Self-Review

- **Spec coverage:** Task 1 enforces all-internal roadmap routing; Tasks 2, 6, and 7 implement shared runtime plus learner progress; Tasks 3-5 create ownership, sandbox, proxy, and quota boundaries; Task 8 covers CRUD/editor parity; Task 9 covers free-tier deployment; Task 10 verifies every approved acceptance criterion.
- **Placeholder scan:** No task delegates undefined work: routes, types, limits, images, test names, commands, and expected outcomes are specified.
- **Type consistency:** `RuntimeProfile` is exactly `"data-science" | "ml-cpu"`; `SandboxSessionClient` creates `SandboxSession`; `sessions.Manager` owns runtime handles; `JupyterSandboxAdapter` implements the existing `KernelAdapter`; `NotebookStore` persists `NotebookRecord`.
