// JavaScript notebook worker: runs cells AND traces them, entirely in the
// browser. The interpreter is synchronous, so running it off the main thread is
// what keeps a heavy cell from freezing the page — and lets the host terminate
// a runaway one outright.
//
// This is also what makes JavaScript notebooks work on deployments with no
// kernel server, the same way Python falls back to Pyodide.
//
// Bundled by the consuming app (`new URL("./javascript-trace.worker.ts",
// import.meta.url)`). web and admin keep byte-identical copies.

import type { WorkerRequest, WorkerResponse } from "@workspace/core"
import {
  handleJavaScriptExecuteRequest,
  handleJavaScriptTraceRequest,
} from "@workspace/core/notebook/visualize/javascript-worker-runtime"

interface WorkerCtx {
  postMessage(data: WorkerResponse): void
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null
}

const ctx = globalThis as unknown as WorkerCtx

/** `In [n]` counter, mirroring the Pyodide worker's per-session numbering. */
let executionCount = 0

ctx.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data
  if (msg.type === "init") {
    // Nothing to load: the interpreter ships in this bundle.
    ctx.postMessage({ type: "ready" })
    return
  }
  if (msg.type === "execute") {
    executionCount += 1
    for (const response of handleJavaScriptExecuteRequest(
      msg.execId,
      msg.code,
      executionCount
    )) {
      ctx.postMessage(response)
    }
    return
  }
  if (msg.type === "trace") {
    ctx.postMessage(handleJavaScriptTraceRequest(msg))
  }
}
