// Worker-side JavaScript trace runtime (C4). The tracer is synchronous and
// self-contained, so this layer only translates between the worker protocol and
// `traceJavaScript`. Kept out of the package barrel: it belongs to the worker
// graph, not the page bundle.

import { traceJavaScript } from "./javascript-runtime"
import {
  normalizeTraceResult,
  TraceProtocolError,
  traceErrorResponse,
  type TraceWorkerRequest,
  type TraceWorkerResponse,
} from "./trace-worker-protocol"

export type { TraceWorkerRequest, TraceWorkerResponse }

/**
 * Traces one cell. Never throws: an interpreter or protocol failure becomes a
 * `trace-error` so the host shows the real reason and can retry. Errors *in the
 * traced program* are not failures — they ride along inside the result.
 */
export function handleJavaScriptTraceRequest(
  request: TraceWorkerRequest
): TraceWorkerResponse {
  try {
    if (request.language !== "javascript") {
      throw new TraceProtocolError(
        `JavaScript trace runtime cannot trace ${String(request.language)}`
      )
    }
    return {
      type: "trace-result",
      id: request.id,
      result: normalizeTraceResult(traceJavaScript(request.code), "javascript"),
    }
  } catch (error) {
    return traceErrorResponse(request.id, error)
  }
}
