import { describe, expect, it } from "vitest"

import { handleJavaScriptTraceRequest } from "./javascript-worker-runtime"
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
