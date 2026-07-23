// @vitest-environment node

import { loadPyodide } from "pyodide"
import { describe, expect, it } from "vitest"

import { createPythonTraceBootstrap } from "./python-bootstrap"
import { TRACE_LIMITS, type TraceResult } from "./types"

let runtime: Awaited<ReturnType<typeof loadPyodide>> | undefined

async function runInPyodide(source: string): Promise<TraceResult> {
  runtime ??= await loadPyodide()
  const result = await runtime.runPythonAsync(
    createPythonTraceBootstrap(source)
  )
  return JSON.parse(String(result)) as TraceResult
}

describe("createPythonTraceBootstrap in Pyodide 0.27.2", () => {
  it("preserves tracing, output, and JSON-safe values across guarded imports", async () => {
    const result = await runInPyodide(
      [
        "import builtins",
        "import importlib",
        "import sys",
        'direct = builtins.__import__("sys")',
        'indirect = importlib.import_module("sys")',
        'reflection_safe = all(getattr(module, "_module", None) is None for module in (sys, direct, indirect))',
        "same_safe_module = sys is direct and direct is indirect and sys.modules['sys'] is sys",
        "sys.settrace(None)",
        "sys.stdout = None",
        "unsafe_integer = 9007199254740992",
        'print("pyodide")',
        "finished = True",
      ].join("\n")
    )

    expect(result.error).toBeUndefined()
    const finalStep = result.steps[result.steps.length - 1]
    expect(finalStep?.stdout).toEqual(["pyodide"])
    expect(finalStep?.frames[0]?.locals.reflection_safe).toEqual({
      kind: "primitive",
      value: true,
    })
    expect(finalStep?.frames[0]?.locals.same_safe_module).toEqual({
      kind: "primitive",
      value: true,
    })
    expect(finalStep?.frames[0]?.locals.unsafe_integer).toEqual({
      kind: "truncated",
      preview: "9007199254740992",
    })
  }, 120_000)

  it("caps capture without throwing a catchable exception", async () => {
    const result = await runInPyodide(
      [
        "caught = False",
        "try:",
        `    for index in range(${TRACE_LIMITS.maxSteps * 2}):`,
        "        value = index",
        "except:",
        "    caught = True",
        'print("caught=" + str(caught))',
      ].join("\n")
    )

    expect(result.truncated).toBe(true)
    expect(result.steps).toHaveLength(TRACE_LIMITS.maxSteps)
    expect(result.error).toBeUndefined()
    expect(result.steps[result.steps.length - 1]?.stdout).toEqual([
      "caught=False",
    ])
  }, 120_000)
})
