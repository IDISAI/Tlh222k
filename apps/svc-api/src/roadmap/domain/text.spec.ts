import { describe, expect, it } from "vitest"
import { normalizeHttpUrl } from "./text"

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
