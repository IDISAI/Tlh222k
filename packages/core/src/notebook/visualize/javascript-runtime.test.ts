import { describe, expect, it } from "vitest"

import { traceJavaScript } from "./javascript-runtime"
import { TRACE_LIMITS, type TraceResult, type TraceValue } from "./types"

function lastStep(result: TraceResult) {
  return result.steps[result.steps.length - 1]
}

function locals(result: TraceResult, frame = 0) {
  return lastStep(result)?.frames[frame]?.locals ?? {}
}

function primitive(value: TraceValue | undefined) {
  return value?.kind === "primitive" ? value.value : undefined
}

function heapNode(result: TraceResult, value: TraceValue | undefined) {
  const id = value?.kind === "reference" ? value.id : undefined
  return lastStep(result)?.heap.find((node) => node.id === id)
}

describe("traceJavaScript", () => {
  it("records variables, output, and the executing line", () => {
    const result = traceJavaScript(
      [
        "const total = 1 + 2",
        'console.log("total", total)',
        "let done = true",
      ].join("\n")
    )

    expect(result.error).toBeUndefined()
    expect(result.language).toBe("javascript")
    expect(result.steps.length).toBeGreaterThanOrEqual(3)
    expect(result.steps.map((step) => step.line)).toEqual(
      expect.arrayContaining([1, 2, 3])
    )
    expect(primitive(locals(result).total)).toBe(3)
    expect(primitive(locals(result).done)).toBe(true)
    expect(lastStep(result)?.stdout).toEqual(["total 3"])
  })

  it("reports a call stack with per-frame locals", () => {
    const result = traceJavaScript(
      [
        "function add(a, b) {",
        "  const sum = a + b",
        "  return sum",
        "}",
        "const answer = add(2, 3)",
      ].join("\n")
    )

    expect(result.error).toBeUndefined()
    const inside = result.steps.find(
      (step) => step.frames[step.frames.length - 1]?.name === "add"
    )
    expect(inside?.frames.map((frame) => frame.name)).toEqual([
      "<module>",
      "add",
    ])
    expect(primitive(inside?.frames[1]?.locals.a)).toBe(2)
    expect(result.steps.map((step) => step.event)).toEqual(
      expect.arrayContaining(["call", "line", "return"])
    )
    expect(primitive(locals(result).answer)).toBe(5)
  })

  it("keeps heap identity stable and survives cycles", () => {
    const result = traceJavaScript(
      [
        "const shared = { name: 'a' }",
        "const alias = shared",
        "shared.self = shared",
        "const list = [shared]",
      ].join("\n")
    )

    expect(result.error).toBeUndefined()
    const sharedValue = locals(result).shared
    expect(locals(result).alias).toEqual(sharedValue)
    const node = heapNode(result, sharedValue)
    expect(primitive(node?.fields.name)).toBe("a")
    expect(node?.fields.self).toEqual({
      kind: "reference",
      id: sharedValue?.kind === "reference" ? sharedValue.id : "",
      label: "Object",
    })
  })

  it("produces byte-identical traces for the same source", () => {
    const source = [
      "const items = [3, 1, 2]",
      "const sorted = items.slice().sort()",
      "console.log(sorted.join('-'))",
    ].join("\n")

    expect(JSON.stringify(traceJavaScript(source))).toBe(
      JSON.stringify(traceJavaScript(source))
    )
  })

  it("supports loops, closures, and array methods", () => {
    const result = traceJavaScript(
      [
        "function makeCounter() {",
        "  let count = 0",
        "  return () => { count = count + 1; return count }",
        "}",
        "const next = makeCounter()",
        "next()",
        "const value = next()",
        "const doubled = [1, 2, 3].map((n) => n * 2)",
        "let total = 0",
        "for (const n of doubled) { total += n }",
        "const evens = doubled.filter((n) => n % 4 === 0)",
      ].join("\n")
    )

    expect(result.error).toBeUndefined()
    expect(primitive(locals(result).value)).toBe(2)
    expect(primitive(locals(result).total)).toBe(12)
    expect(
      Object.values(heapNode(result, locals(result).doubled)?.fields ?? {}).map(
        primitive
      )
    ).toEqual([2, 4, 6])
    expect(
      Object.values(heapNode(result, locals(result).evens)?.fields ?? {}).map(
        primitive
      )
    ).toEqual([4])
  })

  it("caps steps instead of running forever", () => {
    const result = traceJavaScript(
      ["let i = 0", "while (true) {", "  i = i + 1", "}"].join("\n")
    )

    expect(result.truncated).toBe(true)
    expect(result.steps).toHaveLength(TRACE_LIMITS.maxSteps)
  })

  it("bounds collection width, heap size, output lines, and strings", () => {
    const result = traceJavaScript(
      [
        `const wide = Array.from({ length: ${TRACE_LIMITS.maxCollectionEntries + 20} })`,
        `const many = []`,
        `for (let i = 0; i < ${TRACE_LIMITS.maxHeapNodes + 20}; i++) { many.push([i]) }`,
        `const long = "y".repeat(${TRACE_LIMITS.maxStringLength * 2})`,
        `for (let i = 0; i < ${TRACE_LIMITS.maxOutputLines + 20}; i++) { console.log("line") }`,
      ].join("\n")
    )

    for (const step of result.steps) {
      expect(step.heap.length).toBeLessThanOrEqual(TRACE_LIMITS.maxHeapNodes)
      expect(step.stdout.length).toBeLessThanOrEqual(
        TRACE_LIMITS.maxOutputLines
      )
      for (const node of step.heap) {
        expect(Object.keys(node.fields).length).toBeLessThanOrEqual(
          TRACE_LIMITS.maxCollectionEntries
        )
      }
      for (const line of step.stdout) {
        expect(line.length).toBeLessThanOrEqual(TRACE_LIMITS.maxStringLength)
      }
    }
    expect(locals(result).long).toMatchObject({ kind: "truncated" })
  })

  it("keeps huge integers JSON-safe", () => {
    const result = traceJavaScript(
      ["const big = 12345678901234567890n", "const done = 1"].join("\n")
    )

    expect(locals(result).big).toMatchObject({ kind: "truncated" })
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it("serializes syntax errors with a line", () => {
    const result = traceJavaScript("const = 1")

    expect(result.error?.name).toBe("SyntaxError")
    expect(result.error?.line).toBe(1)
    expect(result.steps[result.steps.length - 1]?.event).toBe("exception")
  })

  it("serializes runtime errors and records an exception step", () => {
    const result = traceJavaScript(
      ["const x = 1", "missing()", "const y = 2"].join("\n")
    )

    expect(result.error).toMatchObject({
      name: "ReferenceError",
      message: "missing is not defined",
    })
    expect(result.steps.some((step) => step.event === "exception")).toBe(true)
  })

  it("supports try/catch and throw", () => {
    const result = traceJavaScript(
      [
        "let caught = 'none'",
        "try {",
        "  throw 'boom'",
        "} catch (error) {",
        "  caught = error",
        "}",
        "const done = true",
      ].join("\n")
    )

    expect(result.error).toBeUndefined()
    expect(primitive(locals(result).caught)).toBe("boom")
  })

  it("bounds recursion instead of overflowing the host stack", () => {
    const result = traceJavaScript(
      ["function recurse(n) { return recurse(n + 1) }", "recurse(0)"].join("\n")
    )

    expect(result.error?.name).toBe("RangeError")
  })

  it.each([
    ["constructor escape", "const f = [].constructor"],
    ["prototype escape", "const p = ({}).__proto__"],
    ["global reach", "const g = globalThis"],
    ["eval reach", "const e = eval"],
  ])("blocks %s", (_label, source) => {
    const result = traceJavaScript(source)
    expect(result.error).toBeDefined()
    expect(["TypeError", "ReferenceError"]).toContain(result.error?.name)
  })

  it("names unsupported syntax instead of silently misbehaving", () => {
    const result = traceJavaScript("class Thing {}")

    expect(result.error).toMatchObject({ name: "UnsupportedSyntaxError" })
    expect(result.error?.message).toContain("not supported")
  })
})
