// Worker-side Python trace runtime (C3 Task 3). Pure logic only: no Worker,
// DOM, or Pyodide import. App workers own CDN loading and `postMessage`, then
// delegate `type: "trace"` requests here so web and admin cannot drift.
//
// Deliberately NOT re-exported from the package barrel — importing it must not
// drag React/UI into a worker bundle. Import the subpath:
//   `@workspace/core/notebook/visualize/python-worker-runtime`.

import { createPythonTraceBootstrap } from "./python-bootstrap"
import {
  describe,
  isRecord,
  normalizeTraceResult,
  serializeTraceError,
  stringify,
  TraceProtocolError,
  traceErrorResponse,
  type TraceWorkerRequest,
  type TraceWorkerResponse,
} from "./trace-worker-protocol"

export {
  TraceProtocolError,
  serializeTraceError,
  type TraceWorkerRequest,
  type TraceWorkerResponse,
}

/** The only Pyodide surface the trace path needs. */
export interface PythonTraceRuntime {
  runPythonAsync(code: string): Promise<unknown>
}

/**
 * Runs one cell's source through the Python trace bootstrap and returns the
 * worker response for it. Never throws: a failure becomes `trace-error` so the
 * host can show the real reason and offer a retry.
 */
export async function handlePythonTraceRequest(
  runtime: PythonTraceRuntime,
  request: TraceWorkerRequest
): Promise<TraceWorkerResponse> {
  try {
    if (request.language !== "python") {
      throw new TraceProtocolError(
        `Python trace runtime cannot trace ${String(request.language)}`
      )
    }
    const raw = await runtime.runPythonAsync(
      createPythonTraceBootstrap(request.code)
    )
    const result = normalizeTraceResult(
      parseTraceJson(readTraceJson(raw)),
      "python"
    )
    return { type: "trace-result", id: request.id, result }
  } catch (error) {
    return traceErrorResponse(request.id, error)
  }
}

/**
 * Wraps {@link handlePythonTraceRequest} with the two things a worker needs and
 * a pure function cannot own: load the runtime exactly once, and serialize
 * requests so two traces never share one single-threaded interpreter.
 *
 * A failed load is not cached, so the host's retry gets a fresh attempt.
 */
export function createPythonTraceHandler(
  loadRuntime: () => Promise<PythonTraceRuntime>,
  options: {
    /**
     * Per-request runtime preparation that must not overlap a trace — Pyodide's
     * `loadPackagesFromImports`, for example. Best-effort: a failure here never
     * fails the request, exactly like the normal execute path.
     */
    prepare?: (
      runtime: PythonTraceRuntime,
      request: TraceWorkerRequest
    ) => Promise<void>
  } = {}
): (request: TraceWorkerRequest) => Promise<TraceWorkerResponse> {
  let pending: Promise<PythonTraceRuntime> | null = null
  let queue: Promise<unknown> = Promise.resolve()

  const ensureRuntime = async (): Promise<PythonTraceRuntime> => {
    pending ??= loadRuntime()
    try {
      return await pending
    } catch (error) {
      pending = null
      throw error
    }
  }

  return (request) => {
    const response = queue.then(async () => {
      try {
        const runtime = await ensureRuntime()
        if (options.prepare) {
          try {
            await options.prepare(runtime, request)
          } catch {
            // A missing optional package must not block the trace; the real
            // import error surfaces from the traced run itself.
          }
        }
        return await handlePythonTraceRequest(runtime, request)
      } catch (error) {
        return traceErrorResponse(request.id, error)
      }
    })
    // The queue only sequences; it must never reject and stall later requests.
    queue = response.then(
      () => undefined,
      () => undefined
    )
    return response
  }
}

/**
 * Reads the bootstrap's JSON payload out of whatever Pyodide handed back and
 * destroys every proxy this function owns, including on the failure paths.
 */
function readTraceJson(value: unknown): string {
  if (typeof value === "string") return value
  if (value === null || typeof value !== "object") {
    throw new TraceProtocolError(
      `Python trace bootstrap returned ${describe(value)}`
    )
  }

  const proxy = value as { toJs?: unknown }
  try {
    if (typeof proxy.toJs === "function") {
      const converted = (proxy.toJs as () => unknown)()
      if (typeof converted === "string") return converted
      // Anything else is a proxy this call created and nobody else owns.
      destroyProxy(converted)
    }
    const text = stringify(value)
    if (text === "" || text === "[object Object]") {
      throw new TraceProtocolError(
        "Python trace bootstrap returned a non-string result"
      )
    }
    return text
  } finally {
    destroyProxy(value)
  }
}

function parseTraceJson(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    throw new TraceProtocolError(
      "Python trace bootstrap returned malformed JSON"
    )
  }
}

function destroyProxy(value: unknown): void {
  if (!isRecord(value)) return
  const destroy = value.destroy
  if (typeof destroy !== "function") return
  try {
    ;(destroy as () => void).call(value)
  } catch {
    // Already destroyed, or borrowed and owned elsewhere: nothing to release.
  }
}
