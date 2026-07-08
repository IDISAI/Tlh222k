import { redirect } from "next/navigation"
import { RoadmapViewer } from "@workspace/core"

import { getRole } from "@/lib/auth"
import { ROADMAPS_PATH } from "@/lib/paths"

export const metadata = { title: "Xem roadmap" }

// The admin viewer previews exactly what a web visitor sees, so it must also
// never be cached against the CMS's latest edits.
export const dynamic = "force-dynamic"

/**
 * In-admin read-only viewer for a roadmap / role / skill slug (the "Điều hướng"
 * target that keeps admins on :3002 instead of jumping to the web host). Renders
 * the SAME shared `RoadmapViewer` the web app uses, so the two never diverge.
 */
export default async function AdminRoadmapViewPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const role = await getRole()
  if (role !== "admin" && role !== "super-admin") redirect("/403")

  return (
    <RoadmapViewer
      slug={slug}
      isAuthenticated
      backHref={ROADMAPS_PATH}
      readOnlyBadge
    />
  )
}
