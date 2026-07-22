import { describe, expect, it } from "vitest"

import { TRACE_LIMITS } from "./types"
import { createPythonTraceBootstrap } from "./python-bootstrap"

describe("createPythonTraceBootstrap", () => {
  it("installs a bounded tracer with guaranteed cleanup", () => {
    const bootstrap = createPythonTraceBootstrap("total = 1 + 2")

    expect(bootstrap).toContain("sys.settrace(__codex_trace)")
    expect(bootstrap).toContain("finally:")
    expect(bootstrap).toContain("sys.settrace(None)")
    expect(bootstrap).toContain('__codex_globals = {"__name__": "__main__"}')
    expect(bootstrap).toContain("io.StringIO()")
    expect(bootstrap).toContain("splitlines()")
    expect(bootstrap).toContain('event not in ("call", "line", "return", "exception")')
    expect(bootstrap).toContain(`MAX_STEPS = ${TRACE_LIMITS.maxSteps}`)
    expect(bootstrap).toContain(`MAX_DEPTH = ${TRACE_LIMITS.maxDepth}`)
    expect(bootstrap).toContain(`MAX_STRING_LENGTH = ${TRACE_LIMITS.maxStringLength}`)
  })

  it("serializes bounded, cycle-safe JSON state without private locals", () => {
    const bootstrap = createPythonTraceBootstrap("items = []")

    expect(bootstrap).toContain("__codex_object_ids")
    expect(bootstrap).toContain("isinstance(__codex_value, list)")
    expect(bootstrap).toContain("isinstance(__codex_value, tuple)")
    expect(bootstrap).toContain("isinstance(__codex_value, dict)")
    expect(bootstrap).toContain("isinstance(__codex_value, set)")
    expect(bootstrap).toContain("vars(__codex_value)")
    expect(bootstrap).toContain('startswith("_")')
    expect(bootstrap).toContain("json.dumps(__codex_result")
    expect(bootstrap).toContain('"language": "python"')
    expect(bootstrap).toContain('"frames"')
    expect(bootstrap).toContain('"heap"')
    expect(bootstrap).toContain('"stdout"')
  })

  it("embeds user source only as a JSON value", () => {
    const source = 'quote = "\\\""\nmarker = "${not_python}"'
    const bootstrap = createPythonTraceBootstrap(source)

    expect(bootstrap).toContain(JSON.stringify(JSON.stringify({ source })))
    expect(bootstrap).not.toContain(`exec(${source})`)
    expect(bootstrap).toContain('json.loads(__codex_payload)["source"]')
  })
})
