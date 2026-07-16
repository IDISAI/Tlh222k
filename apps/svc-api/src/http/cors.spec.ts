import { describe, expect, it } from "vitest"
import { isAllowedOrigin } from "./cors"

const allow = ["http://localhost:3000", "https://app.example.com"]

describe("isAllowedOrigin", () => {
  it("allows no-origin callers (curl / server-to-server)", () => {
    expect(isAllowedOrigin(undefined, allow)).toBe(true)
  })

  it("allows explicit allowlist entries", () => {
    expect(isAllowedOrigin("http://localhost:3000", allow)).toBe(true)
    expect(isAllowedOrigin("https://app.example.com", allow)).toBe(true)
  })

  it("allows legit Vercel previews under the -idis team", () => {
    expect(isAllowedOrigin("https://tlh222k-abc123-idis.vercel.app", allow)).toBe(true)
    expect(
      isAllowedOrigin("https://tlh222k-admin-abc123-idis.vercel.app", allow)
    ).toBe(true)
  })

  it("rejects the prefix-spoof the old regex allowed", () => {
    expect(isAllowedOrigin("https://tlh222k-evil.vercel.app", allow)).toBe(false)
    expect(
      isAllowedOrigin("https://tlh222k-evil-notidis.vercel.app", allow)
    ).toBe(false)
  })

  it("rejects unknown origins", () => {
    expect(isAllowedOrigin("https://attacker.com", allow)).toBe(false)
  })

  it("allowAllWhenEmpty allows everything only when the allowlist is empty", () => {
    expect(isAllowedOrigin("https://anything.com", [], { allowAllWhenEmpty: true })).toBe(true)
    expect(isAllowedOrigin("https://anything.com", allow, { allowAllWhenEmpty: true })).toBe(false)
  })
})
