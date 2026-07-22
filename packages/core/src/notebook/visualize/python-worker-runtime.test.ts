import { describe, expect, it, vi } from "vitest"

import {
  createPythonTraceHandler,
  handlePythonTraceRequest,
  type PythonTraceRuntime,
  type TraceWorkerRequest,
} from "./python-worker-runtime"
import type { TraceResult } from "./types"

function request(
  overrides: Partial<TraceWorkerRequest> = {}
): TraceWorkerRequest {
  return {
    type: "trace",
    id: "trace-1",
    language: "python",
    code: "value = 1",
    ...overrides,
  }
}

const TRACE: TraceResult = {
  language: "python",
  truncated: false,
  steps: [
    {
      index: 0,
      line: 1,
      event: "line",
      frames: [{ id: "frame-1", name: "<module>", line: 1, locals: {} }],
      heap: [],
      stdout: [],
    },
  ],
}

/** Stands in for Pyodide: returns whatever the test queues, in order. */
function fakeRuntime(...results: unknown[]): PythonTraceRuntime & {
  calls: string[]
} {
  const calls: string[] = []
  const queued = [...results]
  return {
    calls,
    async runPythonAsync(code: string) {
      calls.push(code)
      const next = queued.length > 1 ? queued.shift() : queued[0]
      if (next instanceof Error) throw next
      return typeof next === "function" ? (next as () => unknown)() : next
    },
  }
}

/** Minimal PyProxy: a JS-owned handle that must be destroyed exactly once. */
function pyProxy(text: string) {
  return {
    destroyed: 0,
    toJs() {
      return text
    },
    destroy() {
      this.destroyed += 1
    },
  }
}

describe("handlePythonTraceRequest", () => {
  it("runs the generated bootstrap and preserves the request id", async () => {
    const runtime = fakeRuntime(JSON.stringify(TRACE))

    const response = await handlePythonTraceRequest(
      runtime,
      request({ id: "trace-42", code: "answer = 42" })
    )

    expect(response).toEqual({
      type: "trace-result",
      id: "trace-42",
      result: TRACE,
    })
    expect(runtime.calls).toHaveLength(1)
    expect(runtime.calls[0]).toContain("__codex_run()")
    expect(runtime.calls[0]).toContain(
      JSON.stringify(JSON.stringify({ source: "answer = 42" }))
    )
  })

  it("converts a Pyodide proxy result and destroys it exactly once", async () => {
    const proxy = pyProxy(JSON.stringify(TRACE))

    const response = await handlePythonTraceRequest(
      fakeRuntime(proxy),
      request()
    )

    expect(response).toMatchObject({ type: "trace-result", result: TRACE })
    expect(proxy.destroyed).toBe(1)
  })

  it("destroys the proxy even when its payload is unusable", async () => {
    const proxy = { toJs: () => ({}), destroy: vi.fn() }

    const response = await handlePythonTraceRequest(
      fakeRuntime(proxy),
      request()
    )

    expect(response.type).toBe("trace-error")
    expect(proxy.destroy).toHaveBeenCalledTimes(1)
  })

  it("destroys a proxy returned by toJs instead of leaking it", async () => {
    const inner = { destroy: vi.fn() }
    const outer = {
      toJs: () => inner,
      destroy: vi.fn(),
      toString: () => "not json",
    }

    await handlePythonTraceRequest(fakeRuntime(outer), request())

    expect(inner.destroy).toHaveBeenCalledTimes(1)
    expect(outer.destroy).toHaveBeenCalledTimes(1)
  })

  it("reports malformed JSON as a serialized trace error", async () => {
    const response = await handlePythonTraceRequest(
      fakeRuntime("{not json"),
      request({ id: "trace-7" })
    )

    expect(response).toEqual({
      type: "trace-error",
      id: "trace-7",
      error: {
        name: "TraceProtocolError",
        message: "Python trace bootstrap returned malformed JSON",
      },
    })
  })

  it.each([
    ["a non-object payload", "42"],
    ["a wrong language", JSON.stringify({ ...TRACE, language: "javascript" })],
    [
      "a missing truncated flag",
      JSON.stringify({ language: "python", steps: [] }),
    ],
    ["missing steps", JSON.stringify({ language: "python", truncated: false })],
    [
      "an unknown step event",
      JSON.stringify({
        ...TRACE,
        steps: [{ ...TRACE.steps[0], event: "teleport" }],
      }),
    ],
    [
      "a malformed step section",
      JSON.stringify({
        ...TRACE,
        steps: [{ ...TRACE.steps[0], heap: null }],
      }),
    ],
  ])("rejects %s", async (_label, payload) => {
    const response = await handlePythonTraceRequest(
      fakeRuntime(payload),
      request()
    )

    expect(response).toMatchObject({
      type: "trace-error",
      id: "trace-1",
      error: { name: "TraceProtocolError" },
    })
  })

  it("keeps a bootstrap-reported user error inside the trace result", async () => {
    const failing: TraceResult = {
      ...TRACE,
      error: { name: "ValueError", message: "boom", line: 3 },
    }

    const response = await handlePythonTraceRequest(
      fakeRuntime(JSON.stringify(failing)),
      request()
    )

    expect(response).toEqual({
      type: "trace-result",
      id: "trace-1",
      result: failing,
    })
  })

  it("serializes a runtime failure with its real name and message", async () => {
    const error = Object.assign(new Error("Traceback: kaboom"), {
      name: "PythonError",
      line: 12,
    })

    const response = await handlePythonTraceRequest(
      fakeRuntime(error),
      request({ id: "trace-9" })
    )

    expect(response).toEqual({
      type: "trace-error",
      id: "trace-9",
      error: { name: "PythonError", message: "Traceback: kaboom", line: 12 },
    })
  })

  it("clips an unbounded error message", async () => {
    const response = await handlePythonTraceRequest(
      fakeRuntime(new Error("x".repeat(5_000))),
      request()
    )

    const message =
      response.type === "trace-error" ? response.error.message : ""
    expect(message).toHaveLength(1_000)
    expect(message.endsWith("…")).toBe(true)
  })

  it("refuses a non-Python language instead of tracing it", async () => {
    const runtime = fakeRuntime(JSON.stringify(TRACE))

    const response = await handlePythonTraceRequest(
      runtime,
      request({ language: "javascript" })
    )

    expect(response).toMatchObject({
      type: "trace-error",
      error: { name: "TraceProtocolError" },
    })
    expect(runtime.calls).toHaveLength(0)
  })
})

describe("createPythonTraceHandler", () => {
  it("loads the runtime once across requests", async () => {
    const runtime = fakeRuntime(JSON.stringify(TRACE))
    const load = vi.fn(async () => runtime)
    const handle = createPythonTraceHandler(load)

    await Promise.all([
      handle(request({ id: "trace-1" })),
      handle(request({ id: "trace-2" })),
      handle(request({ id: "trace-3" })),
    ])

    expect(load).toHaveBeenCalledTimes(1)
    expect(runtime.calls).toHaveLength(3)
  })

  it("keeps concurrent requests on their own ids and never overlaps runs", async () => {
    let running = 0
    let overlapped = false
    const handle = createPythonTraceHandler(async () => ({
      async runPythonAsync(code: string) {
        running += 1
        if (running > 1) overlapped = true
        await new Promise((resolve) => setTimeout(resolve, 1))
        running -= 1
        // The bootstrap embeds the cell as a double-encoded JSON literal.
        const payload = /__codex_payload = (.*)/.exec(code)?.[1] ?? '"{}"'
        const source = String(
          (JSON.parse(JSON.parse(payload) as string) as { source?: string })
            .source ?? ""
        )
        return JSON.stringify({
          ...TRACE,
          steps: [{ ...TRACE.steps[0], stdout: [source] }],
        })
      },
    }))

    const responses = await Promise.all([
      handle(request({ id: "trace-a", code: "a = 1" })),
      handle(request({ id: "trace-b", code: "b = 2" })),
    ])

    expect(overlapped).toBe(false)
    expect(responses.map((response) => response.id)).toEqual([
      "trace-a",
      "trace-b",
    ])
    expect(
      responses.map((response) =>
        response.type === "trace-result"
          ? response.result.steps[0]?.stdout[0]
          : null
      )
    ).toEqual(["a = 1", "b = 2"])
  })

  it("does not cache a failed load, so a retry can succeed", async () => {
    const load = vi
      .fn<() => Promise<PythonTraceRuntime>>()
      .mockRejectedValueOnce(new Error("CDN unreachable"))
      .mockResolvedValue(fakeRuntime(JSON.stringify(TRACE)))
    const handle = createPythonTraceHandler(load)

    const failed = await handle(request())
    const retried = await handle(request({ id: "trace-2" }))

    expect(failed).toMatchObject({
      type: "trace-error",
      error: { message: "CDN unreachable" },
    })
    expect(retried).toMatchObject({ type: "trace-result", id: "trace-2" })
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("prepares each request inside the queue and survives prepare failures", async () => {
    const order: string[] = []
    const handle = createPythonTraceHandler(
      async () => ({
        async runPythonAsync() {
          order.push("trace")
          return JSON.stringify(TRACE)
        },
      }),
      {
        prepare: async (_runtime, pending) => {
          order.push(`prepare:${pending.id}`)
          if (pending.id === "trace-2") throw new Error("package missing")
        },
      }
    )

    const responses = await Promise.all([
      handle(request({ id: "trace-1" })),
      handle(request({ id: "trace-2" })),
    ])

    expect(order).toEqual([
      "prepare:trace-1",
      "trace",
      "prepare:trace-2",
      "trace",
    ])
    expect(
      responses.every((response) => response.type === "trace-result")
    ).toBe(true)
  })

  it("keeps serving after a request rejects", async () => {
    const handle = createPythonTraceHandler(async () =>
      fakeRuntime(new Error("first fails"), JSON.stringify(TRACE))
    )

    const first = await handle(request({ id: "trace-1" }))
    const second = await handle(request({ id: "trace-2" }))

    expect(first).toMatchObject({ type: "trace-error", id: "trace-1" })
    expect(second).toMatchObject({ type: "trace-result", id: "trace-2" })
  })
})
