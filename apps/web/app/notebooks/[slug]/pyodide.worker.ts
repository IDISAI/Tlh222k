// Pyodide execution worker for the /learn Exercise tab. Runs Python entirely
// client-side — DevTools Network shows zero execution requests. Bundled by the
// web app (referenced via `new URL("./pyodide.worker.ts", import.meta.url)`),
// so it owns worker bundling; only `import type` crosses into @workspace/core.

import type {
  CellOutput,
  WorkerRequest,
  WorkerResponse,
} from "@workspace/core"

import { LEARNTOOLS_FILES } from "./learntools"

// Pinned Pyodide, served from jsDelivr's CDN (no npm dependency). Bump this to
// the latest stable Pyodide release; the URL must resolve to an existing
// `pyodide.js` on the CDN, e.g. https://cdn.jsdelivr.net/pyodide/v0.27.2/full/.
const PYODIDE_VERSION = "0.27.2"
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

// ── Minimal Pyodide typings (the runtime is loaded dynamically via CDN) ───────
interface PyProxy {
  toJs(opts?: {
    dict_converter?: (entries: Iterable<[unknown, unknown]>) => unknown
  }): unknown
  destroy(): void
}
interface Pyodide {
  runPython(code: string): unknown
  runPythonAsync(code: string): Promise<unknown>
  loadPackagesFromImports(code: string): Promise<unknown>
  setStdout(opts: { batched: (s: string) => void }): void
  setStderr(opts: { batched: (s: string) => void }): void
  globals: { get(name: string): unknown }
  FS: { mkdirTree(path: string): void; writeFile(path: string, data: string): void }
}

interface WorkerCtx {
  postMessage(data: WorkerResponse): void
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null
  importScripts(...urls: string[]): void
}
declare function loadPyodide(opts: { indexURL: string }): Promise<Pyodide>

const ctx = globalThis as unknown as WorkerCtx

function send(msg: WorkerResponse): void {
  ctx.postMessage(msg)
}

let pyodide: Pyodide | null = null
let executionCount = 0
/** The execId of the run currently streaming stdout/stderr (for routing). */
let activeExecId = 0

/** Bootstrap run once after Pyodide loads: sys.path + result/grade helpers. */
const BOOTSTRAP_PY = `
import sys
if "/lib" not in sys.path:
    sys.path.insert(0, "/lib")

def __nb_format_result__(v):
    if v is None:
        return None
    out = {"text/plain": repr(v)}
    html = getattr(v, "_repr_html_", None)
    if callable(html):
        try:
            r = html()
            if r:
                out["text/html"] = r
        except Exception:
            pass
    return out

def __nb_grades__():
    try:
        from learntools.core import _grades_json
        return _grades_json()
    except Exception:
        return "{}"
`

async function init(): Promise<void> {
  ctx.importScripts(`${INDEX_URL}pyodide.js`)
  const py = await loadPyodide({ indexURL: INDEX_URL })

  // stdout/stderr stream live to the active cell as batched chunks.
  py.setStdout({
    batched: (text) =>
      send({ type: "stream", execId: activeExecId, name: "stdout", text }),
  })
  py.setStderr({
    batched: (text) =>
      send({ type: "stream", execId: activeExecId, name: "stderr", text }),
  })

  // Write the learntools shim into the virtual filesystem.
  py.FS.mkdirTree("/lib/learntools/intro_to_programming")
  for (const [rel, content] of Object.entries(LEARNTOOLS_FILES)) {
    py.FS.writeFile(`/lib/${rel}`, content)
  }
  py.runPython(BOOTSTRAP_PY)

  pyodide = py
  send({ type: "ready" })
}

function toErrorOutput(err: unknown): CellOutput {
  const message = err instanceof Error ? err.message : String(err)
  const lines = message.replace(/\s+$/, "").split("\n")
  const last = lines[lines.length - 1] ?? "PythonError"
  const colon = last.indexOf(": ")
  const ename = colon > 0 ? last.slice(0, colon) : "PythonError"
  const evalue = colon > 0 ? last.slice(colon + 2) : last
  return { kind: "error", ename, evalue, traceback: lines }
}

async function execute(execId: number, code: string): Promise<void> {
  if (!pyodide) {
    send({ type: "fatal", message: "Kernel not initialized" })
    return
  }
  const py = pyodide
  activeExecId = execId
  send({ type: "status", status: "busy" })

  try {
    // Auto-load known packages the cell imports (numpy, pandas, …); unknown
    // imports (our /lib learntools) are ignored.
    try {
      await py.loadPackagesFromImports(code)
    } catch {
      // A missing optional package shouldn't abort the run — the import error
      // surfaces from runPythonAsync below with a proper traceback.
    }

    const result = await py.runPythonAsync(code)

    if (result !== undefined && result !== null) {
      const bundle = formatResult(py, result)
      if (bundle) {
        send({
          type: "output",
          execId,
          output: {
            kind: "execute_result",
            executionCount: executionCount + 1,
            data: bundle,
          },
        })
      }
    }
    if (isPyProxy(result)) result.destroy()

    reportGrades(py, execId)
    executionCount += 1
    send({ type: "done", execId, executionCount })
  } catch (err) {
    send({ type: "output", execId, output: toErrorOutput(err) })
    reportGrades(py, execId)
    send({ type: "done", execId, executionCount })
  } finally {
    send({ type: "status", status: "idle" })
  }
}

function isPyProxy(v: unknown): v is PyProxy {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as PyProxy).destroy === "function"
  )
}

/** Turn a run's last-expression value into the viewer's MimeBundle shape. */
function formatResult(
  py: Pyodide,
  result: unknown
): { html?: string; text?: string } | null {
  const fmt = py.globals.get("__nb_format_result__") as
    | ((v: unknown) => unknown)
    | undefined
  if (!fmt) return null
  const proxy = fmt(result)
  if (!isPyProxy(proxy)) return null
  const obj = proxy.toJs({ dict_converter: Object.fromEntries }) as Record<
    string,
    string
  >
  proxy.destroy()
  const bundle: { html?: string; text?: string } = {}
  if (typeof obj["text/html"] === "string") bundle.html = obj["text/html"]
  if (typeof obj["text/plain"] === "string") bundle.text = obj["text/plain"]
  return bundle.html === undefined && bundle.text === undefined ? null : bundle
}

/** Read learntools grades after a run and forward any recorded ones. */
function reportGrades(py: Pyodide, execId: number): void {
  try {
    const raw = py.runPython("__nb_grades__()")
    const grades = JSON.parse(String(raw)) as Record<
      string,
      "correct" | "incorrect"
    >
    if (Object.keys(grades).length > 0) {
      send({ type: "grades", execId, grades })
    }
  } catch {
    // Grades are best-effort; a parse failure never blocks the run.
  }
}

ctx.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data
  if (msg.type === "init") {
    init().catch((err: unknown) =>
      send({
        type: "fatal",
        message: err instanceof Error ? err.message : String(err),
      })
    )
  } else if (msg.type === "execute") {
    void execute(msg.execId, msg.code)
  }
}
