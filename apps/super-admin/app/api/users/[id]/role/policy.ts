/**
 * Every role a Super-admin can assign. `aio` belongs here because it is the
 * only way a learner is granted INTERNAL content — leaving it out made the
 * entitlement axis unreachable no matter what the roadmap was marked.
 */
export type ManagedRole = "viewer" | "aio" | "admin" | "super-admin"

export type RoleChangeDecision =
  | { ok: true }
  | { ok: false; code: "SELF_DEMOTION" | "LAST_SUPER_ADMIN" }

export interface RoleChangeInput {
  actorId: string
  targetId: string
  currentRole: ManagedRole
  nextRole: ManagedRole
  superAdminCount: number
}

export function validateRoleChange(input: RoleChangeInput): RoleChangeDecision {
  const demotesSuperAdmin =
    input.currentRole === "super-admin" && input.nextRole !== "super-admin"

  if (demotesSuperAdmin && input.actorId === input.targetId) {
    return { ok: false, code: "SELF_DEMOTION" }
  }
  if (demotesSuperAdmin && input.superAdminCount <= 1) {
    return { ok: false, code: "LAST_SUPER_ADMIN" }
  }
  return { ok: true }
}
