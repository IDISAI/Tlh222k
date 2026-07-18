import { describe, expect, it } from "vitest"
import { assertCanWrite, type CurrentUser } from "./clerk"

const user = (role: CurrentUser["role"]): CurrentUser => ({ userId: "u1", role })

describe("assertCanWrite", () => {
  it("throws for guests (null)", () => {
    expect(() => assertCanWrite(null)).toThrow()
  })

  it("throws for viewers", () => {
    expect(() => assertCanWrite(user("viewer"))).toThrow()
  })

  it("passes for admin and super-admin", () => {
    expect(assertCanWrite(user("admin")).role).toBe("admin")
    expect(assertCanWrite(user("super-admin")).role).toBe("super-admin")
  })
})
