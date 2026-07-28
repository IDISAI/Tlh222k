import { describe, expect, it } from "vitest"
import { canAccessInternal, type CurrentUser } from "../auth/clerk"
import { normalizeHttpUrl, normalizeVisibility } from "./hierarchy"

describe("normalizeVisibility", () => {
  it("recognises FREE and INTERNAL, case-insensitively", () => {
    expect(normalizeVisibility("FREE")).toBe("FREE")
    expect(normalizeVisibility("internal")).toBe("INTERNAL")
    expect(normalizeVisibility(" Internal ")).toBe("INTERNAL")
  })

  it("falls back to FREE for anything else", () => {
    // A block with no visibility set, or an unreadable one, must default to
    // the open state rather than accidentally locking it behind Internal.
    expect(normalizeVisibility(null)).toBe("FREE")
    expect(normalizeVisibility(undefined)).toBe("FREE")
    expect(normalizeVisibility("premium")).toBe("FREE")
  })
})

describe("role x visibility matrix", () => {
  const user = (role: CurrentUser["role"]): CurrentUser => ({
    userId: "u1",
    role,
  })

  // Every role this system has, against the one visibility value that ever
  // gates on role — a block only consults `canAccessInternal` once it is
  // found to be Internal. Free content never reaches this check, so it is
  // exempt by construction rather than something to assert per role.
  const cases: Array<[CurrentUser["role"], boolean]> = [
    ["viewer", false],
    ["aio", true],
    ["admin", true],
    ["super-admin", true],
  ]

  it.each(cases)("role %s against an Internal block -> access %s", (role, expected) => {
    expect(normalizeVisibility("INTERNAL")).toBe("INTERNAL")
    expect(canAccessInternal(user(role))).toBe(expected)
  })
})

describe("normalizeHttpUrl", () => {
  it("returns null for empty / whitespace / nullish", () => {
    expect(normalizeHttpUrl(null)).toBeNull()
    expect(normalizeHttpUrl(undefined)).toBeNull()
    expect(normalizeHttpUrl("   ")).toBeNull()
  })

  it("accepts http and https", () => {
    expect(normalizeHttpUrl("https://x.com/nb")).toBe("https://x.com/nb")
    expect(normalizeHttpUrl("http://localhost:3006/n")).toBe("http://localhost:3006/n")
  })

  it("rejects XSS-carrying schemes", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "not a url",
    ]) {
      expect(() => normalizeHttpUrl(bad)).toThrow()
    }
  })
})
