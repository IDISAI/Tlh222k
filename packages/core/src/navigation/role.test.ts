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
  it("enables a configured role outside production", () => {
    expect(devAuthRole("development", "SUPER_ADMIN")).toBe("super-admin")
    expect(devAuthRole("development", "aio")).toBe("aio")
    expect(devAuthRole("test", "viewer")).toBe("viewer")
  })

  it("never bypasses authentication in production", () => {
    expect(devAuthRole("production", "super-admin")).toBeNull()
    // Even a valid role string must not leak through in production.
    expect(devAuthRole("production", "aio")).toBeNull()
  })

  it("rejects missing and unknown role values", () => {
    expect(devAuthRole("development", undefined)).toBeNull()
    expect(devAuthRole("development", "owner")).toBeNull()
    expect(devAuthRole("development", "aioo")).toBeNull()
  })
})
