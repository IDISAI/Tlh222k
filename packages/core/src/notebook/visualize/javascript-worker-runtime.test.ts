import { describe, expect, it } from "vitest"

import {
  handleJavaScriptExecuteRequest,
  handleJavaScriptTraceRequest,
} from "./javascript-worker-runtime"
import type { TraceWorkerRequest } from "./trace-worker-protocol"

function request(
  overrides: Partial<TraceWorkerRequest> = {}
): TraceWorkerRequest {
  return {
    type: "trace",
    id: "trace-1",
    language: "javascript",
    code: "const x = 1",
    ...overrides,
  }
}

describe("handleJavaScriptTraceRequest", () => {
  it("returns a trace result that preserves the request id", () => {
    const response = handleJavaScriptTraceRequest(
      request({ id: "trace-7", code: "const total = 2 + 3" })
    )

    expect(response.type).toBe("trace-result")
    expect(response.id).toBe("trace-7")
    if (response.type !== "trace-result") throw new Error("expected a result")
    expect(response.result.language).toBe("javascript")
    expect(response.result.steps.length).toBeGreaterThan(0)
  })

  it("carries a traced program's own error inside the result, not as a failure", () => {
    const response = handleJavaScriptTraceRequest(
      request({ code: "missing()" })
    )

    expect(response.type).toBe("trace-result")
    if (response.type !== "trace-result") throw new Error("expected a result")
    expect(response.result.error).toMatchObject({ name: "ReferenceError" })
  })

  it("refuses a non-JavaScript language", () => {
    const response = handleJavaScriptTraceRequest(
      request({ language: "python", code: "x = 1" })
    )

    expect(response).toMatchObject({
      type: "trace-error",
      id: "trace-1",
      error: { name: "TraceProtocolError" },
    })
  })

  it("survives a structured-clone round trip", () => {
    const response = handleJavaScriptTraceRequest(
      request({ code: "const items = [1, 2]\nitems.push(items)" })
    )

    expect(JSON.parse(JSON.stringify(response))).toEqual(response)
  })
})

describe("handleJavaScriptExecuteRequest", () => {
  it("streams output and closes the run like a kernel would", () => {
    const messages = handleJavaScriptExecuteRequest(
      7,
      'console.log("hi")\nconsole.log(1 + 1)',
      3
    )

    expect(messages.map((m) => m.type)).toEqual([
      "status",
      "stream",
      "done",
      "status",
    ])
    expect(messages[1]).toEqual({
      type: "stream",
      execId: 7,
      name: "stdout",
      text: "hi\n2\n",
    })
    expect(messages[2]).toEqual({ type: "done", execId: 7, executionCount: 3 })
    expect(messages[3]).toEqual({ type: "status", status: "idle" })
  })

  it("reports a failing cell as an error output but still finishes", () => {
    const messages = handleJavaScriptExecuteRequest(1, "missing()", 1)

    expect(messages.map((m) => m.type)).toEqual([
      "status",
      "output",
      "done",
      "status",
    ])
    expect(messages[1]).toMatchObject({
      type: "output",
      output: { kind: "error", ename: "ReferenceError" },
    })
    // A cell that throws must not leave the kernel stuck on "busy".
    expect(messages[3]).toEqual({ type: "status", status: "idle" })
  })

  it("emits no stream message when the cell prints nothing", () => {
    const messages = handleJavaScriptExecuteRequest(1, "const x = 1", 1)

    expect(messages.map((m) => m.type)).toEqual(["status", "done", "status"])
  })

  it("keeps whatever a runaway loop printed before its time limit", () => {
    const messages = handleJavaScriptExecuteRequest(
      1,
      'console.log("before")\nwhile (true) {}',
      1
    )

    expect(messages[1]).toMatchObject({
      type: "stream",
      text: "before\n",
    })
    expect(messages[2]).toMatchObject({
      type: "output",
      output: { kind: "error", ename: "TimeoutError" },
    })
  }, 20_000)
})
