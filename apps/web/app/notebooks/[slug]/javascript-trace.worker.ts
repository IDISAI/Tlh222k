// JavaScript "Visualize execution" worker. The interpreter is synchronous, so
// running it off the main thread is what keeps a heavy trace from freezing the
// page — and lets WorkerTraceEngine terminate a runaway trace outright.
//
// Bundled by the consuming app (`new URL("./javascript-trace.worker.ts",
// import.meta.url)`). web and admin keep byte-identical copies.

import type { WorkerRequest, WorkerResponse } from "@workspace/core"
import { handleJavaScriptTraceRequest } from "@workspace/core/notebook/visualize/javascript-worker-runtime"

interface WorkerCtx {
  postMessage(data: WorkerResponse): void
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null
}

const ctx = globalThis as unknown as WorkerCtx

ctx.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data
  if (msg.type !== "trace") return
  ctx.postMessage(handleJavaScriptTraceRequest(msg))
}
