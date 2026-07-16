import type { CellOutput, Notebook } from "../types"

export type RuntimeProfile = "data-science" | "ml-cpu"

export interface SandboxSession {
  id: string
  profile: RuntimeProfile
  status: KernelStatus
  proxyBaseUrl: string
  expiresAt: string
}

export interface NotebookMeta {
  published: boolean
  runtimeProfile: RuntimeProfile
  updatedAt: string
}

export interface NotebookRecord {
  notebook: Notebook
  meta: NotebookMeta
}

/**
 * The load-bearing seam of Phase 3: the exercise/editor UI talks to a kernel
 * only through this interface, never importing Pyodide or @jupyterlab/services
 * directly. Two implementations slot in behind it:
 *   - PyodideKernelAdapter — Web Worker, client-side, regular users (web).
 *   - (later) JupyterKernelAdapter — @jupyterlab/services → Go kernel-server, admin.
 */

export type KernelStatus =
  | "uninitialized" // never started (lazy boot: "run a cell to start")
  | "starting" // booting the runtime (~3-5s for Pyodide)
  | "idle" // ready, no cell running
  | "busy" // a cell is executing
  | "error" // the runtime failed to start / crashed

export type QuestionGrade = "unattempted" | "correct" | "incorrect"

/** qid → grade, e.g. { q1: "correct", q2: "incorrect" }. */
export type GradeMap = Record<string, QuestionGrade>

/** Per-execution callbacks; outputs stream in as the cell runs. */
export interface ExecuteCallbacks {
  onStream?: (name: "stdout" | "stderr", text: string) => void
  onOutput?: (output: CellOutput) => void
  /** Fired when a learntools `qN.check()` updated grading during the run. */
  onGrades?: (grades: GradeMap) => void
}

export interface ExecuteResult {
  /** The `In [n]` counter for this run (monotonic per kernel session). */
  executionCount: number
}

export interface KernelAdapter {
  readonly status: KernelStatus
  /** Subscribe to status transitions; returns an unsubscribe fn. */
  subscribeStatus(cb: (status: KernelStatus) => void): () => void
  /** Boot the runtime. Idempotent; resolves once idle. */
  start(): Promise<void>
  /** Run one cell's source; resolves when the cell finishes. */
  execute(code: string, callbacks?: ExecuteCallbacks): Promise<ExecuteResult>
  /** Stop the current run (Pyodide: hard reset — session state is lost). */
  interrupt(): Promise<void>
  /** Tear down and re-boot a fresh runtime. */
  restart(): Promise<void>
  /** Free all resources (terminate the worker). */
  dispose(): void
}

// ── Worker message protocol (shared by adapter ⇄ worker via `import type`) ────
// The worker file lives in the consuming app (apps/web) so the app's bundler
// owns worker bundling; only these type contracts cross the package boundary,
// and `import type` erases them at runtime (no cross-package worker bundling).

/** main → worker */
export type WorkerRequest =
  | { type: "init" }
  | { type: "execute"; execId: number; code: string }

/** worker → main */
export type WorkerResponse =
  | { type: "ready" }
  | { type: "status"; status: "starting" | "idle" | "busy" | "error" }
  | { type: "stream"; execId: number; name: "stdout" | "stderr"; text: string }
  | { type: "output"; execId: number; output: CellOutput }
  | { type: "grades"; execId: number; grades: GradeMap }
  | { type: "done"; execId: number; executionCount: number }
  | { type: "fatal"; message: string }
