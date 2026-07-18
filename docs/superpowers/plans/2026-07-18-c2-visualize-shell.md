# C2 Visualize Execution Shell Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add reusable visualization shell: successful-run gating, one active cell, right-side panel, playback controls, and stable trace presentation contracts without language-specific tracing.

**Architecture:** `packages/core` owns trace schema, playback state, visualization components, and notebook coordination. Runtime records last run outcome. Web/admin remain thin adapters and receive no C2-specific domain logic.

**Tech Stack:** TypeScript, React 19, Vitest, Testing Library, existing notebook runtime/editor components.

---

## Global constraints

- C2 consumes C1 language registry; Python/JavaScript controls enabled, C++/Java/Rust/Go/Julia render disabled with `Coming soon` tooltip.
- Visualization starts only after latest normal execution completed without an error output.
- Exactly one cell owns open visualization panel per notebook.
- Closing/switching panel does not reset cell source, output, execution count, or kernel session.
- C2 uses deterministic fixture traces only. Real Python/JavaScript trace engines land in C3/C4.
- Shared schema must enforce limits used by engines later: 3,000 steps, depth 3, strings 100 characters.

## File structure

- Create: `packages/core/src/notebook/visualize/types.ts`
- Create: `packages/core/src/notebook/visualize/playback.ts`
- Create: `packages/core/src/notebook/visualize/playback.test.ts`
- Create: `packages/core/src/notebook/visualize/fixtures.ts`
- Create: `packages/core/src/notebook/components/VisualizePanel.tsx`
- Create: `packages/core/src/notebook/components/VisualizePanel.test.tsx`
- Modify: `packages/core/src/notebook/runtime/use-notebook-runtime.ts`
- Modify: `packages/core/src/notebook/runtime/use-notebook-runtime.test.tsx`
- Modify: `packages/core/src/notebook/components/InteractiveCodeCell.tsx`
- Modify: `packages/core/src/notebook/components/InteractiveCodeCell.test.tsx`
- Modify: `packages/core/src/notebook/components/InteractiveNotebook.tsx`
- Modify: `packages/core/src/notebook/components/NotebookView.tsx`
- Modify: `packages/core/src/notebook/index.ts`

### Task 1: Define shared trace presentation contract

**Files:**
- Create: `packages/core/src/notebook/visualize/types.ts`
- Create: `packages/core/src/notebook/visualize/fixtures.ts`
- Modify: `packages/core/src/notebook/index.ts`

**Step 1: Write compile-time consumers first**

Define fixture with two steps and reference-linked heap values. Import it through public notebook barrel so missing exports fail typecheck.

```ts
export type TracePrimitive = string | number | boolean | null;

export type TraceValue =
  | { kind: "primitive"; value: TracePrimitive }
  | { kind: "reference"; id: string; label: string }
  | { kind: "truncated"; preview: string };

export interface TraceFrame {
  id: string;
  name: string;
  line: number;
  locals: Record<string, TraceValue>;
}

export interface TraceHeapNode {
  id: string;
  type: string;
  fields: Record<string, TraceValue>;
}

export interface TraceStep {
  index: number;
  line: number;
  event: "call" | "line" | "return" | "exception";
  frames: TraceFrame[];
  heap: TraceHeapNode[];
  stdout: string[];
}

export interface TraceResult {
  language: "python" | "javascript";
  steps: TraceStep[];
  truncated: boolean;
  error?: { name: string; message: string; line?: number };
}
```

**Step 2: Run typecheck to verify missing implementation fails**

Run: `rtk pnpm --filter @workspace/core typecheck`

Expected: FAIL because types/barrel exports do not exist.

**Step 3: Add types, immutable limits, and fixture**

Export `TRACE_LIMITS = { maxSteps: 3000, maxDepth: 3, maxStringLength: 100 } as const`. Keep schema JSON-cloneable for worker messages.

**Step 4: Run focused typecheck**

Run: `rtk pnpm --filter @workspace/core typecheck`

Expected: PASS.

**Step 5: Commit**

```powershell
rtk git add packages/core/src/notebook/visualize packages/core/src/notebook/index.ts
rtk git commit -m "feat(core): define execution trace contract"
```

### Task 2: Build deterministic playback reducer

**Files:**
- Create: `packages/core/src/notebook/visualize/playback.ts`
- Create: `packages/core/src/notebook/visualize/playback.test.ts`

**Step 1: Write failing reducer tests**

Cover:

- empty result clamps cursor to 0 and never plays;
- `first`, `previous`, `next`, `last` clamp correctly;
- `toggle` starts only when another step exists;
- `tick` advances and stops at final step;
- `setSpeed` accepts `0.5 | 1 | 2` only;
- loading a new trace resets cursor and playback.

```ts
expect(playbackReducer(state, { type: "last" })).toEqual({
  ...state,
  cursor: 2,
  playing: false,
});
```

**Step 2: Run test to verify red**

Run: `rtk pnpm --filter @workspace/core test -- src/notebook/visualize/playback.test.ts`

Expected: FAIL because reducer does not exist.

**Step 3: Implement reducer and interval helper**

Keep reducer pure. Export `playbackDelayMs(speed)` returning 1200/600/300ms. Timer ownership stays in panel component.

**Step 4: Run focused test**

Run: `rtk pnpm --filter @workspace/core test -- src/notebook/visualize/playback.test.ts`

Expected: PASS.

**Step 5: Commit**

```powershell
rtk git add packages/core/src/notebook/visualize/playback.ts packages/core/src/notebook/visualize/playback.test.ts
rtk git commit -m "feat(core): add trace playback state"
```

### Task 3: Record latest execution outcome

**Files:**
- Modify: `packages/core/src/notebook/runtime/use-notebook-runtime.ts`
- Modify: `packages/core/src/notebook/runtime/use-notebook-runtime.test.tsx`

**Step 1: Write failing runtime tests**

Add assertions for `lastRunStatus: "never" | "running" | "success" | "error"`:

- initial state `never`;
- becomes `running` synchronously;
- output `{ kind: "error" }` makes final status `error` even when adapter resolves;
- rejected execution makes final status `error`;
- clean completion makes final status `success`;
- source edits after success retain status until next run, allowing visualization of code that actually ran only when source hash matches.

Add `lastExecutedSource?: string`; button gating requires `lastRunStatus === "success" && lastExecutedSource === source`.

**Step 2: Run test to verify red**

Run: `rtk pnpm --filter @workspace/core test -- src/notebook/runtime/use-notebook-runtime.test.tsx`

Expected: FAIL on missing status/source fields.

**Step 3: Implement outcome tracking**

Track `hadError` inside each execution. Set `lastExecutedSource` only when run starts, finalize status once stream ends. Ignore stale completion from an older run by using existing per-cell execution identity or adding monotonically increasing run token.

**Step 4: Run focused tests**

Run: `rtk pnpm --filter @workspace/core test -- src/notebook/runtime/use-notebook-runtime.test.tsx`

Expected: PASS.

**Step 5: Commit**

```powershell
rtk git add packages/core/src/notebook/runtime
rtk git commit -m "feat(core): track notebook run outcome"
```

### Task 4: Render visualization panel and controls

**Files:**
- Create: `packages/core/src/notebook/components/VisualizePanel.tsx`
- Create: `packages/core/src/notebook/components/VisualizePanel.test.tsx`

**Step 1: Write failing component tests**

Render fixture and verify:

- source line list shows current line with full-width arrow/highlight;
- variables, stack, heap, output sections use current step;
- first/previous disabled at start; next/last disabled at end;
- play advances with fake timers and stops at end;
- speed selector changes interval;
- close callback fires;
- error and truncated banners are accessible status text.

**Step 2: Run test to verify red**

Run: `rtk pnpm --filter @workspace/core test -- src/notebook/components/VisualizePanel.test.tsx`

Expected: FAIL because component does not exist.

**Step 3: Implement semantic shell**

Use existing UI primitives. Provide explicit labels for controls. Panel accepts `source`, `trace`, `loading`, `onClose`; no engine knowledge. Use CSS grid/SVG only for simple reference arrows; detailed heap renderer lands C3.

**Step 4: Run focused test**

Run: `rtk pnpm --filter @workspace/core test -- src/notebook/components/VisualizePanel.test.tsx`

Expected: PASS.

**Step 5: Commit**

```powershell
rtk git add packages/core/src/notebook/components/VisualizePanel.tsx packages/core/src/notebook/components/VisualizePanel.test.tsx
rtk git commit -m "feat(core): add trace visualization shell"
```

### Task 5: Coordinate one active cell and responsive notebook layout

**Files:**
- Modify: `packages/core/src/notebook/components/InteractiveCodeCell.tsx`
- Modify: `packages/core/src/notebook/components/InteractiveCodeCell.test.tsx`
- Modify: `packages/core/src/notebook/components/InteractiveNotebook.tsx`
- Modify: `packages/core/src/notebook/components/NotebookView.tsx`
- Modify: `packages/core/src/notebook/index.ts`

**Step 1: Write failing interaction tests**

Cover:

- button hidden before successful execution;
- Python/JavaScript button enabled after matching successful execution;
- five unsupported languages show disabled button and `Coming soon` description;
- changing source after run hides enabled action until rerun;
- opening cell B replaces cell A panel;
- closing panel leaves editor/output intact;
- table of contents remains left and visualization occupies right column at desktop breakpoint;
- small screens stack visualization below notebook without horizontal overflow.

**Step 2: Run tests to verify red**

Run: `rtk pnpm --filter @workspace/core test -- src/notebook/components/InteractiveCodeCell.test.tsx`

Expected: FAIL on missing visualization action/state.

**Step 3: Implement lifted active-cell state**

`InteractiveNotebook` owns `{ cellId, trace } | null`. Pass open/close callbacks to code cells. Keep runtime hook mounted while panel changes. `NotebookView` owns three-region desktop layout: TOC left, notebook center, panel right; preserve existing two-region layout when panel closed.

Use C2 fixture trace only behind an internal injection prop such as `createTrace?: TraceFactory`; production default reports unavailable until C3/C4 register engines. This keeps component tests deterministic and avoids fake production traces.

**Step 4: Run focused and package tests**

Run:

```powershell
rtk pnpm --filter @workspace/core test -- src/notebook/components/InteractiveCodeCell.test.tsx
rtk pnpm --filter @workspace/core test
rtk pnpm --filter @workspace/core lint
rtk pnpm --filter @workspace/core typecheck
```

Expected: all PASS.

**Step 5: Commit**

```powershell
rtk git add packages/core/src/notebook/components packages/core/src/notebook/index.ts
rtk git commit -m "feat(core): integrate notebook visualization shell"
```

### Task 6: C2 regression verification

**Files:**
- Modify only files required by failures found in this task.

**Step 1: Run workspace gates**

```powershell
rtk pnpm lint
rtk pnpm typecheck
rtk pnpm test
rtk pnpm build
```

Expected: all PASS.

**Step 2: Manually verify both notebook hosts**

Start existing local apps using documented commands. Verify web and admin:

- run a Python cell successfully;
- visualize action opens one right panel;
- controls traverse fixture trace;
- edit source and confirm visualization is gated until rerun;
- select each unsupported language and confirm disabled `Coming soon` state;
- resize to mobile and confirm no page-width overflow.

**Step 3: Commit regression fixes, if any**

Stage only concrete files changed to resolve C2 failures, verify staged diff, then commit with message `fix: harden visualization shell`. Skip this commit when no fix was needed.
