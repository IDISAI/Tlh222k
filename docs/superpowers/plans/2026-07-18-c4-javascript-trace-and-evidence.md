# C4 JavaScript Trace and Evidence Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add deterministic JavaScript visualization using Babel plus JS-Interpreter, finish full regression matrix, and record local video evidence for C1–C4.

**Architecture:** Dedicated workers transform supported JavaScript with Babel `retainLines`, execute inside JS-Interpreter without DOM, and normalize interpreter state into C2 `TraceResult`. Web/admin register JavaScript trace engine next to Python. Playwright smoke flow records final evidence without committing binary output.

**Tech Stack:** TypeScript, Web Workers, `@babel/standalone`, `js-interpreter`, React, Vitest, Playwright video.

---

## Global constraints

- JavaScript visualization never executes through browser `eval`, `Function`, DOM, `window`, network, timers, or host object access.
- Babel transform uses `retainLines: true` so trace lines map to cell source.
- Support v1 syntax that transforms to interpreter-compatible ES5. Reject unsupported syntax with actionable error.
- `console.log` is explicit safe native bridge; no general host bridge.
- Same 3,000-step/depth-3/string-100 caps and `TraceResult` schema as Python.
- Final video covers web and admin plus all seven language selectors; artifact remains untracked.

## File structure

- Modify: `packages/core/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `packages/core/src/notebook/visualize/javascript-runtime.ts`
- Create: `packages/core/src/notebook/visualize/javascript-runtime.test.ts`
- Create: `packages/core/src/notebook/visualize/javascript-worker-runtime.ts`
- Create: `packages/core/src/notebook/visualize/javascript-worker-runtime.test.ts`
- Create: `apps/web/app/workers/javascript-trace.worker.ts`
- Create: `apps/admin/app/workers/javascript-trace.worker.ts`
- Modify: `apps/web/app/notebooks/[slug]/learn-client.tsx`
- Modify: `apps/admin/app/notebooks/[slug]/page.tsx`
- Modify: `packages/core/src/notebook/components/InteractiveNotebook.tsx`
- Modify: `packages/core/src/notebook/components/InteractiveNotebook.test.tsx`
- Create: `apps/web/e2e/notebook-visualize.spec.ts`
- Create: `playwright.config.ts`
- Create locally, do not commit: `artifacts/notebook-visualize/`

### Task 1: Add pinned JavaScript tracing dependencies

**Files:**
- Modify: `packages/core/package.json`
- Modify: `pnpm-lock.yaml`

**Step 1: Verify current official package APIs**

Use primary package/repository documentation for current `js-interpreter` constructor/step/state API and `@babel/standalone` transform options. Record exact installed versions and license compatibility in commit notes.

**Step 2: Add production dependencies to core**

Run:

```powershell
rtk pnpm --filter @workspace/core add js-interpreter @babel/standalone
rtk pnpm --filter @workspace/core add -D @types/js-interpreter
```

If maintained types package is unavailable, create narrow local declaration file beside runtime and document only APIs consumed. Do not use broad `any` declarations.

**Step 3: Verify lockfile and package boundary**

```powershell
rtk pnpm install --frozen-lockfile
rtk pnpm --filter @workspace/core typecheck
```

Expected: install and typecheck PASS; no app import appears in `packages/core`.

**Step 4: Commit**

```powershell
rtk git add packages/core/package.json pnpm-lock.yaml packages/core/src/notebook/visualize/js-interpreter.d.ts
rtk git commit -m "build(core): add JavaScript trace runtime"
```

Stage declaration file only when required.

### Task 2: Transform and trace JavaScript deterministically

**Files:**
- Create: `packages/core/src/notebook/visualize/javascript-runtime.ts`
- Create: `packages/core/src/notebook/visualize/javascript-runtime.test.ts`

**Step 1: Write failing runtime tests**

Cover:

- Babel called with `retainLines: true` and deterministic preset/plugin set;
- declarations, assignments, branches, loops, functions, recursion, arrays, and objects;
- `console.log` output order;
- thrown errors with source line;
- repeated references and cycles produce stable heap IDs;
- strings/depth/step limits;
- unavailable DOM/global/network APIs;
- unsupported async/generator/class/module syntax returns clear error;
- source line remains original line after transform.

Use real Babel and JS-Interpreter in tests, not mocks, for semantic cases.

**Step 2: Run test to verify red**

Run: `rtk pnpm --filter @workspace/core test -- src/notebook/visualize/javascript-runtime.test.ts`

Expected: FAIL because runtime does not exist.

**Step 3: Implement Babel transform and interpreter stepping**

Create interpreter with only explicit `console.log` bridge. On each statement boundary, snapshot interpreter scope/call stack and reachable pseudo objects into shared values/heap nodes. Deduplicate consecutive snapshots for same line and unchanged state. Stop at `TRACE_LIMITS.maxSteps` and set `truncated`.

Avoid undocumented interpreter internals when public properties suffice. Encapsulate unavoidable state inspection behind typed adapter functions and characterization tests.

**Step 4: Run focused test**

Run: `rtk pnpm --filter @workspace/core test -- src/notebook/visualize/javascript-runtime.test.ts`

Expected: PASS.

**Step 5: Commit**

```powershell
rtk git add packages/core/src/notebook/visualize/javascript-runtime.ts packages/core/src/notebook/visualize/javascript-runtime.test.ts
rtk git commit -m "feat(core): trace JavaScript execution"
```

### Task 3: Move JavaScript tracing into dedicated workers

**Files:**
- Create: `packages/core/src/notebook/visualize/javascript-worker-runtime.ts`
- Create: `packages/core/src/notebook/visualize/javascript-worker-runtime.test.ts`
- Create: `apps/web/app/workers/javascript-trace.worker.ts`
- Create: `apps/admin/app/workers/javascript-trace.worker.ts`

**Step 1: Write failing worker tests**

Verify request/result/error IDs, lazy runtime initialization, concurrent request serialization, termination on timeout, and fresh interpreter per request.

**Step 2: Run test to verify red**

Run: `rtk pnpm --filter @workspace/core test -- src/notebook/visualize/javascript-worker-runtime.test.ts`

Expected: FAIL because handler does not exist.

**Step 3: Implement pure handler and thin app workers**

Core handler accepts trace request and returns protocol response. Each app worker imports handler, exposes only `self.onmessage`, and never touches DOM. Bundle Babel/interpreter into worker chunk; load only on first JavaScript visualization request.

**Step 4: Run focused tests and app builds**

```powershell
rtk pnpm --filter @workspace/core test -- src/notebook/visualize/javascript-worker-runtime.test.ts
rtk pnpm --filter web build
rtk pnpm --filter admin build
```

Expected: PASS; worker chunks emitted without server-side `self` errors.

**Step 5: Commit**

```powershell
rtk git add packages/core/src/notebook/visualize/javascript-worker-runtime* apps/web/app/workers/javascript-trace.worker.ts apps/admin/app/workers/javascript-trace.worker.ts
rtk git commit -m "feat: run JavaScript traces in workers"
```

### Task 4: Enable JavaScript visualization in web and admin

**Files:**
- Modify: `packages/core/src/notebook/components/InteractiveNotebook.tsx`
- Modify: `packages/core/src/notebook/components/InteractiveNotebook.test.tsx`
- Modify: `apps/web/app/notebooks/[slug]/learn-client.tsx`
- Modify: `apps/admin/app/notebooks/[slug]/page.tsx`

**Step 1: Extend failing integration tests**

Verify JavaScript button enabled after successful/matching run, factory receives `javascript`, trace renders through same panel, engine errors are retryable, unsupported five remain disabled, and Python behavior is unchanged.

**Step 2: Run test to verify red**

Run: `rtk pnpm --filter @workspace/core test -- src/notebook/components/InteractiveNotebook.test.tsx`

Expected: FAIL until JavaScript factory wired.

**Step 3: Implement lazy engine registration**

Host language map:

```ts
{
  python: () => new WorkerTraceEngine(() => new Worker(new URL("../../workers/pyodide.worker.ts", import.meta.url))),
  javascript: () => new WorkerTraceEngine(() => new Worker(new URL("../../workers/javascript-trace.worker.ts", import.meta.url))),
}
```

Adjust relative paths to actual host file location. Memoize one engine per language/notebook mount and dispose on unmount.

**Step 4: Run integration and workspace tests**

```powershell
rtk pnpm --filter @workspace/core test -- src/notebook/components/InteractiveNotebook.test.tsx
rtk pnpm --filter @workspace/core test
rtk pnpm --filter web typecheck
rtk pnpm --filter admin typecheck
```

Expected: PASS.

**Step 5: Commit**

```powershell
rtk git add packages/core/src/notebook/components/InteractiveNotebook* apps/web/app/notebooks/[slug]/learn-client.tsx apps/admin/app/notebooks/[slug]/page.tsx
rtk git commit -m "feat: enable JavaScript execution visualization"
```

### Task 5: Add Playwright evidence scenario

**Files:**
- Create: `apps/web/e2e/notebook-visualize.spec.ts`
- Create: `playwright.config.ts`
- Create locally, do not commit: `artifacts/notebook-visualize/`

**Step 1: Inspect existing browser-test conventions**

Confirm repository has no existing Playwright config/specs. Create root config with `testDir: "./apps/web/e2e"`, separate web/admin `webServer` entries using existing package scripts, trace on first retry, screenshot on failure, and video enabled for evidence run.

**Step 2: Write failing smoke spec**

Use role/label selectors. Scenario:

1. open committed local notebook fixture;
2. show seven languages and profile mapping;
3. execute Python, open visualization, traverse first/next/play/last, inspect variables/stack/heap/output;
4. execute JavaScript and repeat key trace interaction;
5. show disabled `Coming soon` controls for remaining five;
6. open admin notebook editor and repeat language persistence plus one Python visualization;
7. assert no uncaught page errors or failed same-origin requests.

**Step 3: Run spec to verify red or missing behavior**

Run: `rtk pnpm exec playwright test apps/web/e2e/notebook-visualize.spec.ts`

Expected: FAIL until selectors/remaining integration are correct.

**Step 4: Stabilize product and test selectors**

Prefer accessible product labels; use `data-testid` only for graph geometry or duplicate cell regions. Seed notebook through existing fixture/API path, not arbitrary filesystem writes.

**Step 5: Run smoke spec with video enabled**

Configure `video: "on"` for this evidence project/run. Copy final passing video through Playwright reporter/output configuration into `artifacts/notebook-visualize/c1-c4-evidence.webm`. Keep directory gitignored or untracked.

Run: `rtk pnpm exec playwright test apps/web/e2e/notebook-visualize.spec.ts --reporter=line`

Expected: PASS and `.webm` exists with non-zero size.

**Step 6: Commit test/config only**

```powershell
rtk git add apps/web/e2e/notebook-visualize.spec.ts playwright.config.ts
rtk git commit -m "test: cover notebook execution visualization"
```

### Task 6: Final C1–C4 release-candidate verification

**Files:**
- Modify only files required by failures found in this task.

**Step 1: Verify Go kernel-server**

Run from `apps/kernel-server`:

```powershell
rtk go test ./...
rtk go vet ./...
rtk go build ./...
```

Expected: all PASS.

**Step 2: Verify JavaScript/TypeScript workspace**

Run from repository root:

```powershell
rtk pnpm install --frozen-lockfile
rtk pnpm lint
rtk pnpm typecheck
rtk pnpm test
rtk pnpm build
```

Expected: all PASS.

**Step 3: Verify C1 kernel matrix locally**

For each opt-in Compose profile, start service, wait for `/health`, create session, execute hello-world cell, and delete session. Confirm exact mappings:

- Python → `python3`
- JavaScript → `deno`
- C++ → `xcpp17`
- Java → `java`
- Rust → `evcxr`
- Go → `gophernotes`
- Julia → `julia`

Stop each service cleanly before next profile. Capture command outputs in local evidence notes under `artifacts/notebook-visualize/`.

**Step 4: Run final browser evidence spec**

Run: `rtk pnpm exec playwright test apps/web/e2e/notebook-visualize.spec.ts --reporter=line`

Expected: PASS, zero page errors, video generated.

**Step 5: Inspect worktree and artifact**

```powershell
rtk git diff --check
rtk git status --short
rtk powershell Get-Item artifacts/notebook-visualize/c1-c4-evidence.webm
```

Expected: no whitespace errors; only intended source changes plus known pre-existing generated artifacts; video has non-zero length.

**Step 6: Commit final regression fixes, if any**

Stage only concrete files changed to resolve final failures, verify staged diff, then commit with message `fix: complete notebook visualization regression pass`. Skip this commit when no fix was needed.

Do not commit `.webm`, container caches, notebook runtime state, or generated compiler artifacts.
