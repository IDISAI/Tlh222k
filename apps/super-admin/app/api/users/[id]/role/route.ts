import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { roleFromClaims } from "@workspace/core/navigation/role"

const ROLES = ["viewer", "admin", "super-admin"]

/**
 * PATCH /api/users/[id]/role — set a user's role in Clerk publicMetadata.
 * Super-admin only (verified server-side, never trusts the client).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { sessionClaims } = await auth()
  if (roleFromClaims(sessionClaims) !== "super-admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const { id } = await params
  let role: unknown
  try {
    role = (await request.json())?.role
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 })
  }
  if (typeof role !== "string" || !ROLES.includes(role)) {
    return NextResponse.json({ error: "invalid role" }, { status: 400 })
  }

  const client = await clerkClient()
  await client.users.updateUser(id, { publicMetadata: { role } })
  return NextResponse.json({ ok: true })
}
