import { redirect } from "next/navigation"
import { RoadmapView } from "@workspace/core"

import { getRole } from "@/lib/auth"

export default async function Page() {
  // Defense in depth: the proxy already gates, but verify server-side too so a
  // non-super-admin can never render this zone even if the proxy is bypassed.
  const role = await getRole()
  if (role !== "super-admin") redirect("/sign-in")

  return (
    <div className="flex min-h-svh flex-col gap-6 p-6">
      <h1 className="font-medium">Super Admin</h1>
      <RoadmapView />
    </div>
  )
}
