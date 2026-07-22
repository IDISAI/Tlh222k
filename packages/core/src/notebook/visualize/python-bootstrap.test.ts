import { spawnSync } from "node:child_process"

import { describe, expect, it } from "vitest"

import { createPythonTraceBootstrap } from "./python-bootstrap"
import { TRACE_LIMITS, type TraceResult } from "./types"

function findPython(): string {
  for (const command of ["python3", "python"]) {
    const probe = spawnSync(command, ["--version"], {
      encoding: "utf8",
      timeout: 2_000,
    })
    if (!probe.error && probe.status === 0) return command
  }
  throw new Error(
    "Python 3 is required to execute python-bootstrap behavioral tests"
  )
}

const pythonCommand = findPython()

function runTrace(source: string, timeout = 5_000): TraceResult {
  const bootstrap = createPythonTraceBootstrap(source)
  const execution = spawnSync(
    pythonCommand,
    ["-c", `${bootstrap}\nprint(__codex_trace_result_json)`],
    { encoding: "utf8", timeout, maxBuffer: 32 * 1024 * 1024 }
  )

  if (execution.error) throw execution.error
  if (execution.status !== 0) {
    throw new Error(execution.stderr || `Python exited ${execution.status}`)
  }
  return JSON.parse(execution.stdout.trim()) as TraceResult
}

describe("createPythonTraceBootstrap", () => {
  it("aborts an infinite cell at the exact step limit", () => {
    const result = runTrace("while True:\n    pass", 10_000)

    expect(result.truncated).toBe(true)
    expect(result.steps).toHaveLength(TRACE_LIMITS.maxSteps)
    expect(result.error).toBeUndefined()
  }, 15_000)

  it("returns executable stack, heap, locals, line events, and stdout state", () => {
    const result = runTrace(
      [
        "shared = []",
        "shared.append(shared)",
        "alias = shared",
        "def inner(value):",
        "    local = value",
        '    print("first")',
        "    return len(local)",
        "count = inner(alias)",
        'print("second")',
      ].join("\n")
    )

    expect(result.error).toBeUndefined()
    expect(result.steps.map((step) => step.event)).toEqual(
      expect.arrayContaining(["call", "line", "return"])
    )

    const innerStep = result.steps.find(
      (step) => step.frames[step.frames.length - 1]?.name === "inner"
    )
    expect(innerStep?.frames.map((frame) => frame.name)).toEqual([
      "<module>",
      "inner",
    ])
    expect(innerStep?.frames[1]?.locals.value).toMatchObject({
      kind: "reference",
    })

    const finalStep = result.steps[result.steps.length - 1]
    const moduleLocals = finalStep?.frames[0]?.locals
    expect(moduleLocals?.shared).toEqual(moduleLocals?.alias)
    const sharedId =
      moduleLocals?.shared?.kind === "reference"
        ? moduleLocals.shared.id
        : undefined
    const sharedNode = finalStep?.heap.find((node) => node.id === sharedId)
    expect(sharedNode?.fields["0"]).toEqual({
      kind: "reference",
      id: sharedId,
      label: "list",
    })
    expect(finalStep?.stdout).toEqual(["first", "second"])
  })

  it("bounds collection width, cumulative heap, and captured stdout", () => {
    const result = runTrace(
      [
        `wide = list(range(${TRACE_LIMITS.maxCollectionEntries + 20}))`,
        `many = [[value] for value in range(${TRACE_LIMITS.maxHeapNodes + 20})]`,
        `print("x" * ${TRACE_LIMITS.maxOutputBytes * 2})`,
        `print(("y" * ${TRACE_LIMITS.maxStringLength * 2} + "\\n") * ${TRACE_LIMITS.maxOutputLines + 20})`,
      ].join("\n")
    )

    expect(result.error).toBeUndefined()
    const heapSizes = result.steps.map((step) => step.heap.length)
    expect(Math.max(...heapSizes)).toBe(TRACE_LIMITS.maxHeapNodes)
    expect(
      heapSizes.every(
        (size, index) => index === 0 || size >= heapSizes[index - 1]!
      )
    ).toBe(true)
    for (const step of result.steps) {
      expect(step.heap.length).toBeLessThanOrEqual(TRACE_LIMITS.maxHeapNodes)
      for (const node of step.heap) {
        expect(Object.keys(node.fields).length).toBeLessThanOrEqual(
          TRACE_LIMITS.maxCollectionEntries
        )
      }
      expect(step.stdout.length).toBeLessThanOrEqual(
        TRACE_LIMITS.maxOutputLines
      )
      expect(
        step.stdout.every((line) => line.length <= TRACE_LIMITS.maxStringLength)
      ).toBe(true)
      expect(
        Buffer.byteLength(step.stdout.join("\n"), "utf8")
      ).toBeLessThanOrEqual(TRACE_LIMITS.maxOutputBytes)
    }

    const finalStep = result.steps[result.steps.length - 1]
    expect(finalStep?.stdout).toEqual([
      "x".repeat(TRACE_LIMITS.maxStringLength),
    ])
    const wideLocal = finalStep?.frames[0]?.locals.wide
    const wideId = wideLocal?.kind === "reference" ? wideLocal.id : undefined
    expect(
      Object.keys(
        finalStep?.heap.find((node) => node.id === wideId)?.fields ?? {}
      )
    ).toHaveLength(TRACE_LIMITS.maxCollectionEntries)

    const lineResult = runTrace(
      `print(("line\\n") * ${TRACE_LIMITS.maxOutputLines + 20})`
    )
    expect(lineResult.steps[lineResult.steps.length - 1]?.stdout).toHaveLength(
      TRACE_LIMITS.maxOutputLines
    )
  }, 30_000)

  it("orders set fields deterministically without memory addresses", () => {
    const source = 'items = {"delta", "alpha", "charlie", "bravo"}'
    const first = runTrace(source)
    const second = runTrace(source)

    const values = (result: TraceResult) => {
      const step = result.steps[result.steps.length - 1]
      const local = step?.frames[0]?.locals.items
      const id = local?.kind === "reference" ? local.id : undefined
      const node = step?.heap.find((candidate) => candidate.id === id)
      return Object.values(node?.fields ?? {}).map((field) =>
        field.kind === "primitive" ? field.value : undefined
      )
    }

    expect(values(first)).toEqual(["alpha", "bravo", "charlie", "delta"])
    expect(values(second)).toEqual(values(first))
    expect(createPythonTraceBootstrap(source)).not.toContain("id(__codex_item)")

    const objects = runTrace(
      [
        "class Item:",
        "    def __init__(self, name):",
        "        self.name = name",
        'items = {Item("delta"), Item("alpha"), Item("charlie"), Item("bravo")}',
      ].join("\n")
    )
    const objectStep = objects.steps[objects.steps.length - 1]
    const objectLocal = objectStep?.frames[0]?.locals.items
    const objectSetId =
      objectLocal?.kind === "reference" ? objectLocal.id : undefined
    const objectSet = objectStep?.heap.find((node) => node.id === objectSetId)
    const objectNames = Object.values(objectSet?.fields ?? {}).map((field) => {
      if (field.kind !== "reference") return undefined
      const item = objectStep?.heap.find((node) => node.id === field.id)
      const name = item?.fields.name
      return name?.kind === "primitive" ? name.value : undefined
    })
    expect(objectNames).toEqual(["alpha", "bravo", "charlie", "delta"])
  })

  it("preserves dict fields whose display keys collide", () => {
    const prefix = "x".repeat(TRACE_LIMITS.maxStringLength)
    const result = runTrace(
      `mapping = {${JSON.stringify(`${prefix}a`)}: 1, ${JSON.stringify(`${prefix}b`)}: 2, 1: 3, "1": 4}`
    )
    const step = result.steps[result.steps.length - 1]
    const local = step?.frames[0]?.locals.mapping
    const id = local?.kind === "reference" ? local.id : undefined
    const node = step?.heap.find((candidate) => candidate.id === id)

    expect(Object.keys(node?.fields ?? {})).toHaveLength(4)
    expect(
      Object.values(node?.fields ?? {})
        .map((value) => (value.kind === "primitive" ? value.value : undefined))
        .sort()
    ).toEqual([1, 2, 3, 4])
  })

  it("serializes syntax and runtime errors as trace results", () => {
    const syntax = runTrace("if True print('broken')")
    const runtime = runTrace("raise ValueError('boom')")

    expect(syntax.error).toEqual({
      name: "SyntaxError",
      message: "invalid syntax (<cell>, line 1)",
      line: 1,
    })
    expect(syntax.steps[syntax.steps.length - 1]?.event).toBe("exception")
    expect(runtime.error).toEqual({
      name: "ValueError",
      message: "boom",
      line: 1,
    })
    expect(runtime.steps.some((step) => step.event === "exception")).toBe(true)
  })

  it("survives hostile exception strings and object introspection", () => {
    const objectResult = runTrace(
      [
        "class Hostile:",
        "    def __getattribute__(self, name):",
        '        if name == "__dict__":',
        '            raise RuntimeError("blocked")',
        "        return object.__getattribute__(self, name)",
        "value = Hostile()",
        "marker = 1",
      ].join("\n")
    )
    expect(objectResult.error).toBeUndefined()
    const objectStep = objectResult.steps[objectResult.steps.length - 1]
    expect(objectStep?.frames[0]?.locals.value).toMatchObject({
      kind: "truncated",
    })

    const exceptionResult = runTrace(
      [
        "class HostileError(Exception):",
        "    def __str__(self):",
        '        raise RuntimeError("blocked")',
        "raise HostileError()",
      ].join("\n")
    )
    expect(exceptionResult.error).toMatchObject({
      name: "HostileError",
      message: expect.any(String),
      line: 4,
    })
    expect(JSON.stringify(exceptionResult)).not.toContain("blocked")
  })

  it("guards tracing and stdout from common sys-module mutation", () => {
    const result = runTrace(
      [
        "import sys",
        "sys.settrace(None)",
        "sys.stdout = None",
        "first = 1",
        'print("kept")',
        "second = 2",
      ].join("\n")
    )

    expect(result.error).toBeUndefined()
    expect(result.steps.some((step) => step.line === 6)).toBe(true)
    expect(result.steps[result.steps.length - 1]?.stdout).toEqual(["kept"])
  })

  it("installs a bounded tracer with guaranteed cleanup", () => {
    const bootstrap = createPythonTraceBootstrap("total = 1 + 2")

    expect(bootstrap).toContain("sys.settrace(__codex_trace)")
    expect(bootstrap).toContain("finally:")
    expect(bootstrap).toContain("sys.settrace(None)")
    expect(bootstrap).toContain('__codex_globals = {"__name__": "__main__"}')
    expect(bootstrap).toContain("__codex_OutputCapture")
    expect(bootstrap).toContain("__codex_stdout.snapshot()")
    expect(bootstrap).toContain(
      'event not in ("call", "line", "return", "exception")'
    )
    expect(bootstrap).toContain(`MAX_STEPS = ${TRACE_LIMITS.maxSteps}`)
    expect(bootstrap).toContain(`MAX_DEPTH = ${TRACE_LIMITS.maxDepth}`)
    expect(bootstrap).toContain(
      `MAX_STRING_LENGTH = ${TRACE_LIMITS.maxStringLength}`
    )
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
    const source = 'quote = """raw"""\nmarker = "${not_python}"'
    const bootstrap = createPythonTraceBootstrap(source)

    expect(bootstrap).toContain(JSON.stringify(JSON.stringify({ source })))
    expect(bootstrap).not.toContain(`exec(${source})`)
    expect(bootstrap).toContain('json.loads(__codex_payload)["source"]')
  })
})
