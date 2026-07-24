import { describe, expect, it } from "vitest"

import { runAvailability } from "./run-availability"

describe("runAvailability", () => {
  it("runs browser languages with no kernel server", () => {
    for (const language of ["python", "javascript"]) {
      expect(runAvailability(language, { hasKernelServer: false })).toEqual({
        runnable: true,
      })
    }
  })

  it("runs every supported language once a kernel server is configured", () => {
    for (const language of ["cpp", "java", "rust", "go", "julia"]) {
      expect(runAvailability(language, { hasKernelServer: true })).toEqual({
        runnable: true,
      })
    }
  })

  it("names the language and points somewhere useful when it needs a server", () => {
    const result = runAvailability("rust", { hasKernelServer: false })

    expect(result.runnable).toBe(false)
    if (result.runnable) throw new Error("expected Rust to be unrunnable")
    expect(result.title).toContain("Rust")
    // The reader is told what still works, not just what doesn't.
    expect(result.detail).toContain("đọc được")
    expect(result.detail).toContain("Docker")
    // No jargon the audience cannot act on.
    expect(`${result.title} ${result.detail}`).not.toContain("kernel server")
  })

  it("separates a missing worker from a language that needs a server", () => {
    const misconfigured = runAvailability("python", {
      hasKernelServer: false,
      hasBrowserWorker: false,
    })

    expect(misconfigured.runnable).toBe(false)
    if (misconfigured.runnable) throw new Error("expected python to be blocked")
    expect(misconfigured.detail).toContain("lỗi cài đặt")
  })

  it("reports an unknown language instead of guessing", () => {
    const result = runAvailability("brainfuck", { hasKernelServer: true })

    expect(result.runnable).toBe(false)
    if (result.runnable) throw new Error("expected brainfuck to be unsupported")
    expect(result.title).toContain("brainfuck")
  })
})
