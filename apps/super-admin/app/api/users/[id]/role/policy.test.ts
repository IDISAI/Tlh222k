import { describe, expect, it } from "vitest"

import { validateRoleChange } from "./policy"

describe("validateRoleChange", () => {
  it("forbids self-demotion", () => {
    expect(
      validateRoleChange({
        actorId: "u1",
        targetId: "u1",
        currentRole: "super-admin",
        nextRole: "admin",
        superAdminCount: 2,
      })
    ).toEqual({ ok: false, code: "SELF_DEMOTION" })
  })

  it("forbids demoting the last super-admin", () => {
    expect(
      validateRoleChange({
        actorId: "u1",
        targetId: "u2",
        currentRole: "super-admin",
        nextRole: "viewer",
        superAdminCount: 1,
      })
    ).toEqual({ ok: false, code: "LAST_SUPER_ADMIN" })
  })

  it("allows a safe role change", () => {
    expect(
      validateRoleChange({
        actorId: "u1",
        targetId: "u2",
        currentRole: "admin",
        nextRole: "viewer",
        superAdminCount: 1,
      })
    ).toEqual({ ok: true })
  })
})
