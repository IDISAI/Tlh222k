import { describe, expect, it } from "vitest"

import { traceLanguage, visualizeAvailability } from "./availability"

const ran = { source: "x = 1", lastRunStatus: "success", lastExecutedSource: "x = 1" }

describe("traceLanguage", () => {
  it("maps python and javascript, rejects the rest", () => {
    expect(traceLanguage("python")).toBe("python")
    expect(traceLanguage("javascript")).toBe("javascript")
    for (const other of ["cpp", "java", "rust", "go", "julia", "brainfuck", undefined])
      expect(traceLanguage(other)).toBeNull()
  })
})

describe("visualizeAvailability", () => {
  it("is ready after a successful run of the current source", () => {
    expect(visualizeAvailability("python", ran)).toBe("ready")
    expect(visualizeAvailability("javascript", ran)).toBe("ready")
  })

  it("hides before any run, after errors, and after edits", () => {
    expect(visualizeAvailability("python", { source: "x = 1", lastRunStatus: "never" })).toBe("hidden")
    expect(visualizeAvailability("python", { ...ran, lastRunStatus: "error" })).toBe("hidden")
    expect(visualizeAvailability("python", { ...ran, lastRunStatus: "running" })).toBe("hidden")
    expect(visualizeAvailability("python", { ...ran, source: "x = 2" })).toBe("hidden")
  })

  it("marks known non-traceable languages coming-soon regardless of runs", () => {
    for (const language of ["cpp", "java", "rust", "go", "julia"])
      expect(visualizeAvailability(language, ran)).toBe("coming-soon")
  })

  it("hides for unknown languages", () => {
    expect(visualizeAvailability("cobol", ran)).toBe("hidden")
    expect(visualizeAvailability(undefined, ran)).toBe("hidden")
  })
})
