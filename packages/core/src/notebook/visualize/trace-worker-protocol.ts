// Worker-side trace protocol shared by the Python and JavaScript engines.
// Kept separate from either engine so a worker bundle pulls in only the engine
// it actually runs.

import type {
  SerializedTraceError,
  WorkerRequest,
  WorkerResponse,
} from "../kernel/types"
import type { TraceResult, TraceStep } from "./types"

export type TraceWorkerRequest = Extract<WorkerRequest, { type: "trace" }>
export type TraceWorkerResponse = Extract<
  WorkerResponse,
  { type: "trace-result" } | { type: "trace-error" }
>

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

export function traceErrorResponse(
  id: string,
  error: unknown
): TraceWorkerResponse {
  return { type: "trace-error", id, error: serializeTraceError(error) }
}

/**
 * Structural check against the shared trace schema. The panel renders this data
 * directly, so a malformed payload must fail here rather than mid-render.
 */
export function normalizeTraceResult(
  raw: unknown,
  language: TraceResult["language"]
): TraceResult {
  if (!isRecord(raw)) {
    throw new TraceProtocolError("Trace result is not an object")
  }
  if (raw.language !== language) {
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
    language,
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function stringify(value: unknown): string {
  try {
    return String(value)
  } catch {
    return ""
  }
}

export function describe(value: unknown): string {
  if (value === null) return "null"
  if (typeof value === "string") return JSON.stringify(value)
  return typeof value
}

function clip(message: string): string {
  return message.length <= MAX_ERROR_MESSAGE_LENGTH
    ? message
    : `${message.slice(0, MAX_ERROR_MESSAGE_LENGTH - 1)}…`
}
