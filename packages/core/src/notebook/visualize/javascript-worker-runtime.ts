// Worker-side JavaScript runtime (C4). The interpreter is synchronous and
// self-contained, so this layer only translates between the worker protocol and
// `traceJavaScript` / `runJavaScript`. Kept out of the package barrel: it
// belongs to the worker graph, not the page bundle.

import { runJavaScript, traceJavaScript } from "./javascript-runtime"
import {
  normalizeTraceResult,
  TraceProtocolError,
  traceErrorResponse,
  type TraceWorkerRequest,
  type TraceWorkerResponse,
} from "./trace-worker-protocol"
import type { CellOutput } from "../types"
import type { WorkerResponse } from "../kernel/types"

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

/**
 * Runs one cell and returns the messages a kernel adapter expects. This is the
 * browser-only execution path: it lets JavaScript notebooks run wherever the
 * kernel server is unreachable, the way Python falls back to Pyodide.
 */
export function handleJavaScriptExecuteRequest(
  execId: number,
  code: string,
  executionCount: number
): WorkerResponse[] {
  const messages: WorkerResponse[] = [{ type: "status", status: "busy" }]
  const { stdout, error } = runJavaScript(code)

  if (stdout.length > 0) {
    messages.push({
      type: "stream",
      execId,
      name: "stdout",
      text: `${stdout.join("\n")}\n`,
    })
  }
  if (error) {
    const output: CellOutput = {
      kind: "error",
      ename: error.name,
      evalue: error.message,
      traceback:
        error.line === undefined
          ? [`${error.name}: ${error.message}`]
          : [`${error.name}: ${error.message}`, `  tại dòng ${error.line}`],
    }
    messages.push({ type: "output", execId, output })
  }
  messages.push({ type: "done", execId, executionCount })
  messages.push({ type: "status", status: "idle" })
  return messages
}
