import { describe, expect, it } from "vitest"
import {
  assertCanWrite,
  canAccessInternal,
  displayNameFromClaims,
  type CurrentUser,
} from "./clerk"

const user = (role: CurrentUser["role"]): CurrentUser => ({
  userId: "u1",
  role,
})

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

describe("displayNameFromClaims", () => {
  it("prefers a human profile value over an opaque Clerk id", () => {
    expect(
      displayNameFromClaims({
        sub: "user_3GGvZvMkxX2iK3SKzCb5K6MCepq",
        first_name: "Linh",
        last_name: "Hoang",
      })
    ).toBe("Linh Hoang")
  })
})

describe("canAccessInternal", () => {
  // Every role against the one axis that matters here: can they open a block
  // marked Internal. aio, admin and super-admin all can — aio because that is
  // the whole point of the role, admin/super-admin so whoever publishes a
  // block can read back what they published.
  const cases: Array<[CurrentUser["role"] | null, boolean]> = [
    ["viewer", false],
    ["aio", true],
    ["admin", true],
    ["super-admin", true],
  ]

  it.each(cases)("role %s -> Internal access %s", (role, expected) => {
    const caller = role ? user(role) : null
    expect(canAccessInternal(caller)).toBe(expected)
  })

  it("refuses a guest with no session", () => {
    expect(canAccessInternal(null)).toBe(false)
  })
})
