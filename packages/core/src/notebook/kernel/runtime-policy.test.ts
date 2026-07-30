import { describe, expect, it } from "vitest"

import { canRunNotebook, chooseRuntime } from "./runtime-policy"

describe("chooseRuntime", () => {
  it("uses the kernel server whenever one is configured", () => {
    expect(chooseRuntime("http://localhost:3006", "development")).toEqual({
      kind: "kernel-server",
      url: "http://localhost:3006",
    })
    expect(chooseRuntime("https://kernels.example", "production")).toEqual({
      kind: "kernel-server",
      url: "https://kernels.example",
    })
  })

  it("falls back locally in development", () => {
    expect(chooseRuntime(undefined, "development")).toEqual({
      kind: "local-fallback",
    })
    expect(chooseRuntime("   ", "test")).toEqual({ kind: "local-fallback" })
  })

  it("refuses to fall back in production", () => {
    // The contract forbids a deployed environment running Pyodide: it is a
    // different engine with different versions, so learners would see results
    // the author never saw, and nothing would report the substitution.
    const choice = chooseRuntime(undefined, "production")
    expect(choice.kind).toBe("unavailable")
  })

  it("treats a blank URL in production as missing, not as a URL", () => {
    expect(chooseRuntime("   ", "production").kind).toBe("unavailable")
  })
})

describe("canRunNotebook", () => {
  it("lets a signed-in learner run", () => {
    expect(
      canRunNotebook({
        runtime: { kind: "kernel-server", url: "https://k" },
        authenticated: true,
      })
    ).toEqual({ ok: true })
  })

  it("asks a guest to sign in", () => {
    const verdict = canRunNotebook({
      runtime: { kind: "kernel-server", url: "https://k" },
      authenticated: false,
    })
    expect(verdict).toEqual({ ok: false, reason: "Đăng nhập để chạy code." })
  })

  it("reports the missing runtime ahead of the missing session", () => {
    // Telling a guest to sign in when no runtime exists sends them through a
    // login that cannot help them.
    const verdict = canRunNotebook({
      runtime: { kind: "unavailable", reason: "Máy chủ chạy code chưa sẵn sàng." },
      authenticated: false,
    })
    expect(verdict).toEqual({
      ok: false,
      reason: "Máy chủ chạy code chưa sẵn sàng.",
    })
  })

  it("still requires an account on the local fallback", () => {
    expect(
      canRunNotebook({ runtime: { kind: "local-fallback" }, authenticated: false })
        .ok
    ).toBe(false)
  })
})
