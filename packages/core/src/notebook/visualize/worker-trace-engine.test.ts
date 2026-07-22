import { afterEach, describe, expect, it, vi } from "vitest"

import { WorkerTraceEngine } from "./worker-trace-engine"
import type { TraceResult } from "./types"

class FakeWorker {
  readonly messages: unknown[] = []
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  terminated = false

  postMessage(message: unknown): void {
    this.messages.push(message)
  }

  terminate(): void {
    this.terminated = true
  }

  respond(message: unknown): void {
    this.onmessage?.({ data: message } as MessageEvent<unknown>)
  }

  crash(message: string): void {
    this.onerror?.({ message } as ErrorEvent)
  }
}

const trace = (language: "python" | "javascript", line: number): TraceResult => ({
  language,
  steps: [
    {
      index: 0,
      line,
      event: "line",
      frames: [],
      heap: [],
      stdout: [],
    },
  ],
  truncated: false,
})

const requestId = (worker: FakeWorker, index: number): string =>
  (worker.messages[index] as { id: string }).id

afterEach(() => {
  vi.useRealTimers()
})

describe("WorkerTraceEngine", () => {
  it("returns a rejected promise when its worker factory throws", async () => {
    const engine = new WorkerTraceEngine(() => {
      throw new Error("Worker factory failed")
    })

    await expect(
      engine.trace({ language: "python", source: "x = 1" })
    ).rejects.toThrow("Worker factory failed")
  })

  it("correlates concurrent trace results by request ID", async () => {
    const worker = new FakeWorker()
    const engine = new WorkerTraceEngine(() => worker as unknown as Worker)

    const first = engine.trace({ language: "python", source: "first" })
    const second = engine.trace({ language: "javascript", source: "second" })

    expect(worker.messages).toEqual([
      { type: "trace", id: expect.any(String), language: "python", code: "first" },
      { type: "trace", id: expect.any(String), language: "javascript", code: "second" },
    ])

    worker.respond({
      type: "trace-result",
      id: requestId(worker, 1),
      result: trace("javascript", 2),
    })
    worker.respond({
      type: "trace-result",
      id: requestId(worker, 0),
      result: trace("python", 1),
    })

    await expect(first).resolves.toEqual(trace("python", 1))
    await expect(second).resolves.toEqual(trace("javascript", 2))
  })

  it("rejects a matching trace error from the worker", async () => {
    const worker = new FakeWorker()
    const engine = new WorkerTraceEngine(() => worker as unknown as Worker)
    const pending = engine.trace({ language: "python", source: "broken" })
    const rejected = expect(pending).rejects.toMatchObject({
      name: "SyntaxError",
      message: "unexpected token",
      line: 4,
    })

    worker.respond({
      type: "trace-error",
      id: requestId(worker, 0),
      error: { name: "SyntaxError", message: "unexpected token", line: 4 },
    })

    await rejected
  })

  it("rejects pending traces when its worker crashes", async () => {
    const worker = new FakeWorker()
    const engine = new WorkerTraceEngine(() => worker as unknown as Worker)
    const pending = engine.trace({ language: "python", source: "x = 1" })
    const rejected = expect(pending).rejects.toThrow("Trace worker crashed")

    worker.crash("Trace worker crashed")

    expect(worker.terminated).toBe(true)
    await rejected
  })

  it("ignores an error from a worker replaced after timeout", async () => {
    vi.useFakeTimers()
    const firstWorker = new FakeWorker()
    const secondWorker = new FakeWorker()
    const workers = [firstWorker, secondWorker]
    const engine = new WorkerTraceEngine(
      () => workers.shift() as unknown as Worker,
      100
    )
    const first = engine.trace({ language: "python", source: "first" })
    const firstRejected = expect(first).rejects.toThrow(
      "Trace timed out after 0.1s"
    )

    await vi.advanceTimersByTimeAsync(100)
    await firstRejected

    const second = engine.trace({ language: "python", source: "second" })
    void second.catch(() => {})
    firstWorker.crash("stale worker crashed")

    expect(secondWorker.terminated).toBe(false)
    secondWorker.respond({
      type: "trace-result",
      id: requestId(secondWorker, 0),
      result: trace("python", 2),
    })
    await expect(second).resolves.toEqual(trace("python", 2))
  })

  it("terminates its dedicated worker after the default 10 second timeout", async () => {
    vi.useFakeTimers()
    const worker = new FakeWorker()
    const engine = new WorkerTraceEngine(() => worker as unknown as Worker)
    const pending = engine.trace({ language: "python", source: "while True: pass" })
    const rejected = expect(pending).rejects.toThrow("Trace timed out after 10s")

    await vi.advanceTimersByTimeAsync(10_000)

    expect(worker.terminated).toBe(true)
    await rejected
  })

  it("ignores a duplicate response after its request has settled", async () => {
    const worker = new FakeWorker()
    const engine = new WorkerTraceEngine(() => worker as unknown as Worker)
    const first = engine.trace({ language: "python", source: "first" })
    const firstId = requestId(worker, 0)

    worker.respond({ type: "trace-result", id: firstId, result: trace("python", 1) })
    await expect(first).resolves.toEqual(trace("python", 1))

    const second = engine.trace({ language: "python", source: "second" })
    worker.respond({ type: "trace-result", id: firstId, result: trace("python", 99) })
    worker.respond({
      type: "trace-result",
      id: requestId(worker, 1),
      result: trace("python", 2),
    })

    await expect(second).resolves.toEqual(trace("python", 2))
  })

  it("rejects pending traces and terminates worker on disposal", async () => {
    const worker = new FakeWorker()
    const engine = new WorkerTraceEngine(() => worker as unknown as Worker)
    const first = engine.trace({ language: "python", source: "first" })
    const second = engine.trace({ language: "python", source: "second" })
    const firstRejected = expect(first).rejects.toThrow("Trace engine disposed")
    const secondRejected = expect(second).rejects.toThrow("Trace engine disposed")

    engine.dispose()

    expect(worker.terminated).toBe(true)
    await firstRejected
    await secondRejected
  })
})
