import type { SerializedTraceError, WorkerRequest, WorkerResponse } from "../kernel/types"
import type { TraceResult } from "./types"
import type { TraceEngine, TraceRequest } from "./engine"

const DEFAULT_TIMEOUT_MS = 10_000

interface PendingTrace {
  resolve: (result: TraceResult) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export type TraceWorkerFactory = () => Worker

/**
 * Correlates trace requests with responses from its own worker. This worker is
 * intentionally separate from normal cell execution, so a trace timeout never
 * interrupts the user's live kernel.
 */
export class WorkerTraceEngine implements TraceEngine {
  private worker: Worker | null = null
  private readonly pending = new Map<string, PendingTrace>()
  private nextRequestId = 1
  private disposed = false

  constructor(
    private readonly createWorker: TraceWorkerFactory,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS
  ) {}

  trace(request: TraceRequest): Promise<TraceResult> {
    if (this.disposed) return Promise.reject(new Error("Trace engine disposed"))

    const id = `trace-${this.nextRequestId++}`
    const worker = this.ensureWorker()

    return new Promise<TraceResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.resetWorker(
          new Error(`Trace timed out after ${this.timeoutMs / 1000}s`)
        )
      }, this.timeoutMs)

      this.pending.set(id, { resolve, reject, timer })
      try {
        worker.postMessage({
          type: "trace",
          id,
          language: request.language,
          code: request.source,
        } satisfies WorkerRequest)
      } catch (error) {
        this.resetWorker(toError(error, "Trace worker failed to accept request"))
      }
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.resetWorker(new Error("Trace engine disposed"))
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker

    const worker = this.createWorker()
    worker.onmessage = (event: MessageEvent<WorkerResponse>) =>
      this.handleMessage(event.data)
    worker.onerror = (event) =>
      this.resetWorker(new Error(event.message || "Trace worker crashed"))
    this.worker = worker
    return worker
  }

  private handleMessage(message: WorkerResponse): void {
    if (message.type !== "trace-result" && message.type !== "trace-error") return

    const pending = this.pending.get(message.id)
    if (!pending) return

    this.pending.delete(message.id)
    clearTimeout(pending.timer)
    if (message.type === "trace-result") {
      pending.resolve(message.result)
      return
    }
    pending.reject(deserializeTraceError(message.error))
  }

  private resetWorker(error: Error): void {
    this.worker?.terminate()
    this.worker = null
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pending.clear()
  }
}

function deserializeTraceError(serialized: SerializedTraceError): Error & { line?: number } {
  const error = new Error(serialized.message) as Error & { line?: number }
  error.name = serialized.name
  if (serialized.line !== undefined) error.line = serialized.line
  return error
}

function toError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback)
}
