// Worker-side Python trace runtime (C3 Task 3). Pure logic only: no Worker,
// DOM, or Pyodide import. App workers own CDN loading and `postMessage`, then
// delegate `type: "trace"` requests here so web and admin cannot drift.
//
// Deliberately NOT re-exported from the package barrel — importing it must not
// drag React/UI into a worker bundle. Import the subpath:
//   `@workspace/core/notebook/visualize/python-worker-runtime`.

import type {
  SerializedTraceError,
  WorkerRequest,
  WorkerResponse,
} from "../kernel/types"
import { createPythonTraceBootstrap } from "./python-bootstrap"
import type { TraceResult, TraceStep } from "./types"

export type TraceWorkerRequest = Extract<WorkerRequest, { type: "trace" }>
export type TraceWorkerResponse = Extract<
  WorkerResponse,
  { type: "trace-result" } | { type: "trace-error" }
>

/** The only Pyodide surface the trace path needs. */
export interface PythonTraceRuntime {
  runPythonAsync(code: string): Promise<unknown>
}

/** Pyodide tracebacks are unbounded; the panel shows a single message line. */
const MAX_ERROR_MESSAGE_LENGTH = 1_000

const STEP_EVENTS = new Set(["call", "line", "return", "exception"])

/** A trace response that never reached the shared schema. */
export class TraceProtocolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TraceProtocolError"
  }
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
    const result = normalizeTraceResult(parseTraceJson(readTraceJson(raw)))
    return { type: "trace-result", id: request.id, result }
  } catch (error) {
    return {
      type: "trace-error",
      id: request.id,
      error: serializeTraceError(error),
    }
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
        return {
          type: "trace-error" as const,
          id: request.id,
          error: serializeTraceError(error),
        }
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

export function serializeTraceError(error: unknown): SerializedTraceError {
  if (error instanceof Error) {
    const line = (error as { line?: unknown }).line
    const serialized: SerializedTraceError = {
      name: error.name || "TraceError",
      message: clip(error.message || String(error)),
    }
    if (typeof line === "number" && Number.isInteger(line) && line > 0) {
      serialized.line = line
    }
    return serialized
  }
  return { name: "TraceError", message: clip(stringify(error)) }
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

/**
 * Structural check against the shared trace schema. The panel renders this
 * data directly, so a malformed payload must fail here rather than mid-render.
 */
export function normalizeTraceResult(raw: unknown): TraceResult {
  if (!isRecord(raw)) {
    throw new TraceProtocolError("Trace result is not an object")
  }
  if (raw.language !== "python") {
    throw new TraceProtocolError(
      `Trace result declares language ${describe(raw.language)}`
    )
  }
  if (typeof raw.truncated !== "boolean") {
    throw new TraceProtocolError("Trace result is missing a truncated flag")
  }
  if (!Array.isArray(raw.steps)) {
    throw new TraceProtocolError("Trace result is missing its steps")
  }

  const result: TraceResult = {
    language: "python",
    truncated: raw.truncated,
    steps: raw.steps.map(normalizeStep),
  }
  const error = normalizeError(raw.error)
  if (error) result.error = error
  return result
}

function normalizeStep(raw: unknown, index: number): TraceStep {
  if (!isRecord(raw)) {
    throw new TraceProtocolError(`Trace step ${index} is not an object`)
  }
  const { line, event, frames, heap, stdout } = raw
  if (typeof line !== "number" || !Number.isFinite(line)) {
    throw new TraceProtocolError(`Trace step ${index} has no line number`)
  }
  if (typeof event !== "string" || !STEP_EVENTS.has(event)) {
    throw new TraceProtocolError(
      `Trace step ${index} has unknown event ${describe(event)}`
    )
  }
  if (
    !Array.isArray(frames) ||
    !Array.isArray(heap) ||
    !Array.isArray(stdout)
  ) {
    throw new TraceProtocolError(`Trace step ${index} has a malformed section`)
  }
  return {
    index,
    line,
    event: event as TraceStep["event"],
    frames: frames as TraceStep["frames"],
    heap: heap as TraceStep["heap"],
    stdout: stdout.map((entry) => stringify(entry)),
  }
}

function normalizeError(raw: unknown): TraceResult["error"] | undefined {
  if (raw === undefined || raw === null) return undefined
  if (!isRecord(raw)) {
    throw new TraceProtocolError("Trace error is not an object")
  }
  if (typeof raw.name !== "string" || typeof raw.message !== "string") {
    throw new TraceProtocolError("Trace error is missing a name or message")
  }
  const error: NonNullable<TraceResult["error"]> = {
    name: raw.name,
    message: raw.message,
  }
  if (typeof raw.line === "number" && Number.isFinite(raw.line)) {
    error.line = raw.line
  }
  return error
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function stringify(value: unknown): string {
  try {
    return String(value)
  } catch {
    return ""
  }
}

function describe(value: unknown): string {
  if (value === null) return "null"
  if (typeof value === "string") return JSON.stringify(value)
  return typeof value
}

function clip(message: string): string {
  return message.length <= MAX_ERROR_MESSAGE_LENGTH
    ? message
    : `${message.slice(0, MAX_ERROR_MESSAGE_LENGTH - 1)}…`
}
