import type {
  ExecuteCallbacks,
  ExecuteResult,
  KernelAdapter,
  KernelStatus,
  WorkerRequest,
  WorkerResponse,
} from "../types"

/** Hard cap on a single cell run before the worker is force-rebooted. */
const DEFAULT_TIMEOUT_MS = 30_000

interface PendingExec {
  callbacks: ExecuteCallbacks
  resolve: (result: ExecuteResult) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * Runs Python client-side in a Web Worker via Pyodide (regular users, no server
 * execution). The worker is created lazily on first `start()` through the
 * injected factory — the actual `pyodide.worker.ts` lives in the consuming app
 * so its bundler owns worker bundling; this class only speaks the message
 * protocol from `../types`.
 */
export class PyodideKernelAdapter implements KernelAdapter {
  private worker: Worker | null = null
  private readonly createWorker: () => Worker
  private readonly timeoutMs: number

  private _status: KernelStatus = "uninitialized"
  private readonly statusSubs = new Set<(s: KernelStatus) => void>()

  private startPromise: Promise<void> | null = null
  private resolveStart: (() => void) | null = null
  private rejectStart: ((e: Error) => void) | null = null

  private nextExecId = 1
  /** Pyodide is single-threaded: at most one execution is in flight. */
  private pending: PendingExec | null = null

  constructor(createWorker: () => Worker, timeoutMs = DEFAULT_TIMEOUT_MS) {
    this.createWorker = createWorker
    this.timeoutMs = timeoutMs
  }

  get status(): KernelStatus {
    return this._status
  }

  subscribeStatus(cb: (status: KernelStatus) => void): () => void {
    this.statusSubs.add(cb)
    return () => this.statusSubs.delete(cb)
  }

  private setStatus(status: KernelStatus): void {
    if (this._status === status) return
    this._status = status
    for (const cb of this.statusSubs) cb(status)
  }

  start(): Promise<void> {
    if (this.startPromise) return this.startPromise
    this.setStatus("starting")
    const worker = this.createWorker()
    this.worker = worker
    worker.onmessage = (e: MessageEvent<WorkerResponse>) =>
      this.handleMessage(e.data)
    worker.onerror = (e) =>
      this.fail(new Error(e.message || "Pyodide worker crashed"))

    this.startPromise = new Promise<void>((resolve, reject) => {
      this.resolveStart = resolve
      this.rejectStart = reject
    })
    this.post({ type: "init" })
    return this.startPromise
  }

  async execute(
    code: string,
    callbacks: ExecuteCallbacks = {}
  ): Promise<ExecuteResult> {
    await this.start()
    if (this.pending) {
      throw new Error("A cell is already running — wait for it to finish")
    }
    const execId = this.nextExecId++
    return new Promise<ExecuteResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        // Watchdog: an infinite loop can't be interrupted without a shared
        // interrupt buffer, so reboot the worker and surface a timeout.
        void this.restart()
        reject(
          new Error(
            `Execution timed out after ${this.timeoutMs / 1000}s and was stopped`
          )
        )
      }, this.timeoutMs)
      this.pending = { callbacks, resolve, reject, timer }
      this.post({ type: "execute", execId, code })
    })
  }

  async interrupt(): Promise<void> {
    // Pyodide has no cooperative interrupt here (needs a SharedArrayBuffer +
    // cross-origin isolation), so a "stop" is a full reboot; session state
    // is lost — the UI warns about this.
    await this.restart()
  }

  async restart(): Promise<void> {
    this.teardown(new Error("Kernel restarted"))
    await this.start()
  }

  dispose(): void {
    this.teardown(new Error("Kernel disposed"))
    this.setStatus("uninitialized")
    this.statusSubs.clear()
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private post(msg: WorkerRequest): void {
    this.worker?.postMessage(msg)
  }

  private handleMessage(msg: WorkerResponse): void {
    switch (msg.type) {
      case "ready":
        this.setStatus("idle")
        this.resolveStart?.()
        this.resolveStart = null
        this.rejectStart = null
        return
      case "status":
        this.setStatus(msg.status)
        return
      case "stream":
        this.pending?.callbacks.onStream?.(msg.name, msg.text)
        return
      case "output":
        this.pending?.callbacks.onOutput?.(msg.output)
        return
      case "grades":
        this.pending?.callbacks.onGrades?.(msg.grades)
        return
      case "done": {
        const p = this.pending
        this.pending = null
        if (p) {
          clearTimeout(p.timer)
          p.resolve({ executionCount: msg.executionCount })
        }
        return
      }
      case "fatal":
        this.fail(new Error(msg.message))
        return
    }
  }

  private fail(error: Error): void {
    this.setStatus("error")
    this.rejectStart?.(error)
    this.teardown(error)
  }

  /** Reject any in-flight work and terminate the worker. */
  private teardown(error: Error): void {
    if (this.pending) {
      clearTimeout(this.pending.timer)
      this.pending.reject(error)
      this.pending = null
    }
    if (this.rejectStart) {
      this.rejectStart(error)
      this.rejectStart = null
      this.resolveStart = null
    }
    this.worker?.terminate()
    this.worker = null
    this.startPromise = null
  }
}
