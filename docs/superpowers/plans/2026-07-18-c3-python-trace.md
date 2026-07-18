# C3 Python Trace Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Trace Python cells in isolated Pyodide workers and render real line-by-line state through C2 visualization shell.

**Architecture:** A core-owned Python tracer bootstrap uses `sys.settrace` inside fresh namespace, serializes bounded frames/heap/output into shared `TraceResult`, and runs through explicit worker protocol. Thin web/admin workers call same core bootstrap. Normal execution remains on selected kernel adapter; tracing is separate, on-demand `TraceEngine` capability.

**Tech Stack:** TypeScript, Web Workers, Pyodide 0.27.2, Python `sys.settrace`, React, Vitest.

---

## Global constraints

- Never parse nbformat in Go; trace receives already selected cell source.
- Fresh Python globals per trace request; no state leakage from normal execution or prior traces.
- Hard caps: 3,000 steps, recursive depth 3, strings 100 chars.
- Reject infinite/long traces with timeout and return serializable error.
- User code cannot mutate tracer internals.
- Both web and admin consume same `TraceEngine` contract.

## File structure

- Create: `packages/core/src/notebook/visualize/engine.ts`
- Create: `packages/core/src/notebook/visualize/worker-trace-engine.ts`
- Create: `packages/core/src/notebook/visualize/worker-trace-engine.test.ts`
- Create: `packages/core/src/notebook/visualize/python-bootstrap.ts`
- Create: `packages/core/src/notebook/visualize/python-bootstrap.test.ts`
- Create: `packages/core/src/notebook/visualize/python-worker-runtime.ts`
- Create: `packages/core/src/notebook/visualize/python-worker-runtime.test.ts`
- Modify: `packages/core/src/notebook/kernel/types.ts`
- Modify: `packages/core/src/notebook/components/VisualizePanel.tsx`
- Modify: `packages/core/src/notebook/components/VisualizePanel.test.tsx`
- Modify: `packages/core/src/notebook/components/InteractiveNotebook.tsx`
- Modify: `packages/core/src/notebook/index.ts`
- Modify: `apps/web/app/workers/pyodide.worker.ts`
- Modify: `apps/web/app/notebooks/[slug]/learn-client.tsx`
- Modify: `apps/admin/app/workers/pyodide.worker.ts`
- Modify: `apps/admin/app/notebooks/[slug]/page.tsx`

### Task 1: Define trace engine and worker protocol

**Files:**
- Create: `packages/core/src/notebook/visualize/engine.ts`
- Create: `packages/core/src/notebook/visualize/worker-trace-engine.ts`
- Create: `packages/core/src/notebook/visualize/worker-trace-engine.test.ts`
- Modify: `packages/core/src/notebook/kernel/types.ts`
- Modify: `packages/core/src/notebook/index.ts`

**Step 1: Write failing protocol tests**

Use fake Worker. Verify request correlation, result resolution, worker error rejection, timeout termination, duplicate response ignore, and disposal rejection.

```ts
export interface TraceEngine {
  trace(request: { language: "python" | "javascript"; source: string }): Promise<TraceResult>;
  dispose(): void;
}
```

Extend worker request/response unions with request IDs:

```ts
type WorkerRequest =
  | { type: "init" }
  | { type: "execute"; id: string; code: string }
  | { type: "trace"; id: string; language: "python"; code: string };

type WorkerResponse =
  | ExistingWorkerResponse
  | { type: "trace-result"; id: string; result: TraceResult }
  | { type: "trace-error"; id: string; error: SerializedTraceError };
```

**Step 2: Run test to verify red**

Run: `rtk pnpm --filter @workspace/core test -- src/notebook/visualize/worker-trace-engine.test.ts`

Expected: FAIL because engine does not exist.

**Step 3: Implement engine**

Default timeout 10 seconds. Do not terminate shared normal-execution worker on a single trace timeout; create a dedicated trace worker through injected factory. Correlate every response by ID.

**Step 4: Run focused test and typecheck**

```powershell
rtk pnpm --filter @workspace/core test -- src/notebook/visualize/worker-trace-engine.test.ts
rtk pnpm --filter @workspace/core typecheck
```

Expected: PASS.

**Step 5: Commit**

```powershell
rtk git add packages/core/src/notebook/visualize packages/core/src/notebook/kernel/types.ts packages/core/src/notebook/index.ts
rtk git commit -m "feat(core): add worker trace engine"
```

### Task 2: Implement bounded Python bootstrap

**Files:**
- Create: `packages/core/src/notebook/visualize/python-bootstrap.ts`
- Create: `packages/core/src/notebook/visualize/python-bootstrap.test.ts`

**Step 1: Write failing bootstrap contract tests**

Test generated Python source contains and configures:

- `sys.settrace` install and unconditional cleanup in `finally`;
- fresh `{"__name__": "__main__"}` namespace;
- stdout capture preserving line order;
- call/line/return/exception event capture;
- step/depth/string constants from `TRACE_LIMITS`;
- cycle-safe identity map for lists, tuples, dicts, sets, and user objects;
- dunder/internal local filtering;
- JSON-only result serialization.

Also test stable source embedding: user source passes as JSON string value, never interpolated into Python syntax.

**Step 2: Run test to verify red**

Run: `rtk pnpm --filter @workspace/core test -- src/notebook/visualize/python-bootstrap.test.ts`

Expected: FAIL because generator does not exist.

**Step 3: Implement bootstrap generator**

Bootstrap outline:

```py
def __codex_trace(frame, event, arg):
    if frame.f_code.co_filename != "<cell>":
        return __codex_trace
    # snapshot bounded stack/locals/heap/stdout
    return __codex_trace

try:
    sys.settrace(__codex_trace)
    exec(compile(USER_SOURCE, "<cell>", "exec"), fresh_globals, fresh_globals)
except BaseException as exc:
    # append serializable error and exception step
finally:
    sys.settrace(None)
```

Do not traverse modules, classes, callables, or private attributes. Represent those as truncated previews.

**Step 4: Run focused tests**

Run: `rtk pnpm --filter @workspace/core test -- src/notebook/visualize/python-bootstrap.test.ts`

Expected: PASS.

**Step 5: Commit**

```powershell
rtk git add packages/core/src/notebook/visualize/python-bootstrap.ts packages/core/src/notebook/visualize/python-bootstrap.test.ts
rtk git commit -m "feat(core): generate bounded Python traces"
```

### Task 3: Execute Python trace inside Pyodide

**Files:**
- Create: `packages/core/src/notebook/visualize/python-worker-runtime.ts`
- Create: `packages/core/src/notebook/visualize/python-worker-runtime.test.ts`
- Modify: `apps/web/app/workers/pyodide.worker.ts`
- Modify: `apps/admin/app/workers/pyodide.worker.ts`

**Step 1: Write failing runtime tests**

Inject fake Pyodide `runPythonAsync`. Verify:

- initialization happens once;
- trace request runs generated bootstrap;
- `toJs`/JSON proxy conversion is normalized and proxies destroyed;
- malformed result becomes `trace-error`;
- concurrent requests preserve IDs;
- execution requests still behave unchanged.

**Step 2: Run test to verify red**

Run: `rtk pnpm --filter @workspace/core test -- src/notebook/visualize/python-worker-runtime.test.ts`

Expected: FAIL because runtime does not exist.

**Step 3: Implement reusable message handler**

Core exports a pure `handlePythonTraceRequest(pyodide, request)` returning response. App worker files keep CDN loading and postMessage wiring, then delegate trace branch to core. Normal `execute` branch stays backward compatible.

**Step 4: Run focused tests and both app typechecks**

```powershell
rtk pnpm --filter @workspace/core test -- src/notebook/visualize/python-worker-runtime.test.ts
rtk pnpm --filter web typecheck
rtk pnpm --filter admin typecheck
```

Expected: PASS.

**Step 5: Commit**

```powershell
rtk git add packages/core/src/notebook/visualize/python-worker-runtime* apps/web/app/workers/pyodide.worker.ts apps/admin/app/workers/pyodide.worker.ts
rtk git commit -m "feat: trace Python cells in Pyodide workers"
```

### Task 4: Render frames, heap nodes, and reference arrows

**Files:**
- Modify: `packages/core/src/notebook/components/VisualizePanel.tsx`
- Modify: `packages/core/src/notebook/components/VisualizePanel.test.tsx`

**Step 1: Extend failing component tests**

Fixture includes primitives, repeated reference, cycle, nested fields, exception, and stdout. Verify:

- stack order shows current frame first and call ancestry below;
- locals render primitive/truncated/reference variants;
- each unique heap ID renders once;
- references use stable SVG marker and accessible textual fallback (`x → list #1`);
- missing target does not crash;
- output accumulates through current step only.

**Step 2: Run focused test to verify red**

Run: `rtk pnpm --filter @workspace/core test -- src/notebook/components/VisualizePanel.test.tsx`

Expected: FAIL on missing detailed renderer.

**Step 3: Implement resilient renderer**

Measure reference endpoints with refs/`ResizeObserver`; draw SVG overlay when geometry exists. Textual reference remains primary accessible representation. Recompute on cursor, resize, and panel width. Never place trace values into `dangerouslySetInnerHTML`.

**Step 4: Run focused tests**

Run: `rtk pnpm --filter @workspace/core test -- src/notebook/components/VisualizePanel.test.tsx`

Expected: PASS.

**Step 5: Commit**

```powershell
rtk git add packages/core/src/notebook/components/VisualizePanel.tsx packages/core/src/notebook/components/VisualizePanel.test.tsx
rtk git commit -m "feat(core): render Python execution state"
```

### Task 5: Wire Python engine into web and admin

**Files:**
- Modify: `packages/core/src/notebook/components/InteractiveNotebook.tsx`
- Modify: `apps/web/app/notebooks/[slug]/learn-client.tsx`
- Modify: `apps/admin/app/notebooks/[slug]/page.tsx`

**Step 1: Write failing integration tests**

At core boundary, inject fake `TraceEngine`. Verify visualization calls engine only for Python successful/matching source, loading state appears, result opens panel, rejection shows retryable error, and switching/closing disposes no shared engine prematurely.

**Step 2: Run tests to verify red**

Run: `rtk pnpm --filter @workspace/core test -- src/notebook/components/InteractiveNotebook.test.tsx`

Expected: FAIL on missing engine prop/lifecycle.

**Step 3: Read installed Next.js docs before client/worker edits**

Read relevant Client Components and lazy-loading/worker bundling guidance under pinned Next 16.2.6 docs in `node_modules/.pnpm/.../node_modules/next/dist/docs/`. Record path used in implementation notes.

**Step 4: Implement host factories**

Web/admin create dedicated Pyodide trace worker lazily on first visualization request. Core accepts language-to-engine factory. Dispose on notebook unmount. Keep `NEXT_PUBLIC_KERNEL_SERVER_URL` normal execution behavior unchanged.

**Step 5: Run integration and app checks**

```powershell
rtk pnpm --filter @workspace/core test -- src/notebook/components/InteractiveNotebook.test.tsx
rtk pnpm --filter web lint
rtk pnpm --filter web typecheck
rtk pnpm --filter admin lint
rtk pnpm --filter admin typecheck
```

Expected: PASS.

**Step 6: Commit**

```powershell
rtk git add packages/core/src/notebook/components/InteractiveNotebook.tsx apps/web/app/notebooks/[slug]/learn-client.tsx apps/admin/app/notebooks/[slug]/page.tsx
rtk git commit -m "feat: enable Python execution visualization"
```

### Task 6: C3 correctness and regression verification

**Files:**
- Modify only files required by failures found in this task.

**Step 1: Run Python behavior matrix in browser**

Verify web and admin with cells for:

- assignment/arithmetic;
- nested function calls and returns;
- list/dict mutation and repeated references;
- self-referential list;
- `print` output;
- raised exception;
- string over 100 chars;
- nesting deeper than 3;
- loop over 3,000 trace events;
- infinite loop timeout followed by successful retry.

Expected: bounded result, clear error/truncation banners, responsive controls, no worker leak.

**Step 2: Run workspace gates**

```powershell
rtk pnpm lint
rtk pnpm typecheck
rtk pnpm test
rtk pnpm build
```

Expected: all PASS.

**Step 3: Commit fixes, if any**

Stage only concrete files changed to resolve C3 failures, verify staged diff, then commit with message `fix: harden Python execution tracing`. Skip this commit when no fix was needed.
