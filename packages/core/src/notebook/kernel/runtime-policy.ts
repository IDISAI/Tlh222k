export type RuntimeChoice =
  | { kind: "kernel-server"; url: string }
  | { kind: "local-fallback" }
  | { kind: "unavailable"; reason: string }

/**
 * Which engine may run a notebook cell.
 *
 * Production must use the Go kernel-server. The Pyodide and bundled-JS
 * runtimes are development conveniences: they execute a *different* engine
 * with different versions and no installed packages, so a deploy that quietly
 * fell back to them would show learners results that do not match the ones the
 * author saw — and nothing would report it. That silence is the failure mode,
 * not the missing URL.
 *
 * This mirrors the rule CLAUDE.md states for the mock roadmap service: when a
 * deployed path loses its backend it must fail loudly, never degrade to a
 * local stand-in.
 */
export function chooseRuntime(
  kernelUrl: string | undefined,
  nodeEnv: string | undefined
): RuntimeChoice {
  const url = kernelUrl?.trim()
  if (url) return { kind: "kernel-server", url }

  if (nodeEnv === "production") {
    return {
      kind: "unavailable",
      reason:
        "Máy chủ chạy code chưa được cấu hình. Vui lòng liên hệ quản trị viên.",
    }
  }
  return { kind: "local-fallback" }
}

/**
 * Whether this caller may press Run.
 *
 * Guests may read a notebook — the committed code and its saved output are
 * part of the content — but executing costs someone's compute, so it needs an
 * account. Returning the reason lets the button explain itself rather than
 * sitting there disabled.
 */
export function canRunNotebook(input: {
  runtime: RuntimeChoice
  authenticated: boolean
}): { ok: true } | { ok: false; reason: string } {
  if (input.runtime.kind === "unavailable") {
    return { ok: false, reason: input.runtime.reason }
  }
  if (!input.authenticated) {
    return { ok: false, reason: "Đăng nhập để chạy code." }
  }
  return { ok: true }
}
