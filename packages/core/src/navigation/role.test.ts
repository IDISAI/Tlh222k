import { describe, expect, it } from "vitest"

import { devAuthRole } from "./role"

describe("devAuthRole", () => {
  it("enables a configured role outside production", () => {
    expect(devAuthRole("development", "SUPER_ADMIN")).toBe("super-admin")
    expect(devAuthRole("test", "viewer")).toBe("viewer")
  })

  it("never bypasses authentication in production", () => {
    expect(devAuthRole("production", "super-admin")).toBeNull()
  })

  it("rejects missing and unknown role values", () => {
    expect(devAuthRole("development", undefined)).toBeNull()
    expect(devAuthRole("development", "owner")).toBeNull()
  })
})
