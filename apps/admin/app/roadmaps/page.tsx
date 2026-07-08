import { redirect } from "next/navigation"
import { RoadmapListAdmin } from "@workspace/core"

import { getRole } from "@/lib/auth"
import { ROADMAPS_PATH } from "@/lib/paths"

export const metadata = { title: "Quản lý Roadmap" }

export default async function RoadmapsPage() {
  const role = await getRole()
  // Server-side gate (Req 1.2) — also covers the dev auth bypass, where the
  // proxy is a plain pass-through.
  if (role !== "admin" && role !== "super-admin") redirect("/403")

  return (
    <div className="container mx-auto px-4 py-8">
      <RoadmapListAdmin role={role} builderBasePath={ROADMAPS_PATH} />
    </div>
  )
}
