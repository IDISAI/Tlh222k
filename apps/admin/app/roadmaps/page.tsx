import { redirect } from "next/navigation"
import { ReloadOnBackForward, RoadmapListAdmin } from "@workspace/core"

import { getRole } from "@/lib/auth"
import { FORBIDDEN_PATH, ROADMAPS_PATH } from "@/lib/paths"

export const metadata = { title: "Quản lý Roadmap" }

export default async function RoadmapsPage() {
  const role = await getRole()
  // Server-side gate (Req 1.2) — also covers the dev auth bypass, where the
  // proxy is a plain pass-through.
  if (role !== "admin" && role !== "super-admin") redirect(FORBIDDEN_PATH)

  return (
    <div className="container mx-auto px-4 py-8">
      {/* List is client-fetched and reached by full-page navs — same
          back_forward staleness guard as the builder page. */}
      <ReloadOnBackForward />
      <RoadmapListAdmin role={role} builderBasePath={ROADMAPS_PATH} />
    </div>
  )
}
