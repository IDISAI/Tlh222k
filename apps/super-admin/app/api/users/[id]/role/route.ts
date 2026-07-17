import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { roleFromClaims } from "@workspace/core/navigation/role"

import { type ManagedRole, validateRoleChange } from "./policy"

const ROLES: readonly ManagedRole[] = ["viewer", "admin", "super-admin"]
const PAGE_SIZE = 100

function managedRole(value: unknown): ManagedRole {
  return ROLES.some((role) => role === value)
    ? (value as ManagedRole)
    : "viewer"
}

/**
 * PATCH /api/users/[id]/role — set a user's role in Clerk publicMetadata.
 * Super-admin only (verified server-side, never trusts the client).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { sessionClaims, userId: actorId } = await auth()
  if (!actorId || roleFromClaims(sessionClaims) !== "super-admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const { id } = await params
  let role: unknown
  try {
    role = (await request.json())?.role
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 })
  }
  if (typeof role !== "string" || !ROLES.some((allowed) => allowed === role)) {
    return NextResponse.json({ error: "invalid role" }, { status: 400 })
  }

  const client = await clerkClient()
  const target = await client.users.getUser(id)
  const currentRole = managedRole(target.publicMetadata.role)
  const nextRole = role as ManagedRole

  let superAdminCount = 0
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await client.users.getUserList({ limit: PAGE_SIZE, offset })
    superAdminCount += page.data.filter(
      (user) => managedRole(user.publicMetadata.role) === "super-admin"
    ).length
    if (
      offset + page.data.length >= page.totalCount ||
      page.data.length === 0
    ) {
      break
    }
  }

  const decision = validateRoleChange({
    actorId,
    targetId: id,
    currentRole,
    nextRole,
    superAdminCount,
  })
  if (!decision.ok) {
    return NextResponse.json({ error: decision.code }, { status: 409 })
  }

  const sessionIds: string[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await client.sessions.getSessionList({
      userId: id,
      limit: PAGE_SIZE,
      offset,
    })
    sessionIds.push(...page.data.map((session) => session.id))
    if (
      offset + page.data.length >= page.totalCount ||
      page.data.length === 0
    ) {
      break
    }
  }

  await client.users.updateUser(id, { publicMetadata: { role: nextRole } })
  await Promise.all(
    sessionIds.map((sessionId) => client.sessions.revokeSession(sessionId))
  )
  console.info(
    JSON.stringify({
      event: "user_role_changed",
      actorId,
      targetId: id,
      oldRole: currentRole,
      newRole: nextRole,
      timestamp: new Date().toISOString(),
    })
  )
  return NextResponse.json({ ok: true })
}
