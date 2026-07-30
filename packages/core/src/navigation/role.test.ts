import { describe, expect, it } from "vitest"

import { devAuthRole, normalizeRole } from "./role"

describe("normalizeRole", () => {
  it("accepts aio alongside admin and super-admin", () => {
    expect(normalizeRole("aio")).toBe("aio")
    expect(normalizeRole("admin")).toBe("admin")
    expect(normalizeRole("super-admin")).toBe("super-admin")
  })

  it("accepts the loose casing the Clerk dashboard produces", () => {
    expect(normalizeRole("AIO")).toBe("aio")
    expect(normalizeRole(" Aio ")).toBe("aio")
    expect(normalizeRole("SUPER_ADMIN")).toBe("super-admin")
  })

  it("falls a near-miss value to viewer rather than to aio", () => {
    // A typo in the dashboard must lock a learner out, never wave them into
    // Internal content by accident.
    expect(normalizeRole("aioo")).toBe("viewer")
    expect(normalizeRole("ai0")).toBe("viewer")
    expect(normalizeRole("aio-learner")).toBe("viewer")
  })

  it("maps missing or unreadable values to viewer", () => {
    expect(normalizeRole(undefined)).toBe("viewer")
    expect(normalizeRole(null)).toBe("viewer")
    expect(normalizeRole(42)).toBe("viewer")
    expect(normalizeRole("")).toBe("viewer")
  })
})

describe("devAuthRole", () => {
  it("enables a configured role outside production when bypass is on", () => {
    expect(devAuthRole("development", "SUPER_ADMIN", "true")).toBe("super-admin")
    expect(devAuthRole("development", "aio", "true")).toBe("aio")
    expect(devAuthRole("test", "viewer", "true")).toBe("viewer")
  })

  it("never bypasses authentication in production", () => {
    expect(devAuthRole("production", "super-admin", "true")).toBeNull()
    // Even a valid role string must not leak through in production.
    expect(devAuthRole("production", "aio", "true")).toBeNull()
  })

  it("rejects missing and unknown role values", () => {
    expect(devAuthRole("development", undefined, "true")).toBeNull()
    expect(devAuthRole("development", "owner", "true")).toBeNull()
    expect(devAuthRole("development", "aioo", "true")).toBeNull()
  })

  it("stays off when bypass is not explicitly enabled", () => {
    expect(devAuthRole("development", "super-admin", "false")).toBeNull()
    expect(devAuthRole("development", "super-admin", undefined)).toBeNull()
  })
})
