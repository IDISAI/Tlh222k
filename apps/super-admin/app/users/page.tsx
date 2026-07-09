import { redirect } from "next/navigation"
import { clerkClient } from "@clerk/nextjs/server"
import { normalizeRole } from "@workspace/core"

import { getRole } from "@/lib/auth"
import { SIGN_IN_PATH } from "@/lib/paths"
import { UserTable, type ManagedUser } from "./user-table"

export const metadata = { title: "Quản lý người dùng" }

/**
 * Super-admin console: list Clerk users and manage their role
 * (viewer | admin | super-admin) via publicMetadata. Clerk is the user store.
 */
export default async function UsersPage() {
  const role = await getRole()
  if (role !== "super-admin") redirect(SIGN_IN_PATH)

  const client = await clerkClient()
  const res = await client.users.getUserList({
    limit: 100,
    orderBy: "-created_at",
  })

  const users: ManagedUser[] = res.data.map((u) => {
    const primary =
      u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
        ?.emailAddress ??
      u.emailAddresses[0]?.emailAddress ??
      "—"
    return {
      id: u.id,
      email: primary,
      name: [u.firstName, u.lastName].filter(Boolean).join(" ") || "—",
      imageUrl: u.imageUrl,
      role: normalizeRole(u.publicMetadata?.role),
    }
  })

  return (
    <div className="container mx-auto px-4 py-8">
      <UserTable users={users} />
    </div>
  )
}
