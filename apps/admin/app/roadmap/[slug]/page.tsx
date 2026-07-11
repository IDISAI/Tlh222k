import { redirect } from "next/navigation"
import { RoadmapViewer } from "@workspace/core"

import { getRole } from "@/lib/auth"
import { FORBIDDEN_PATH, NOTION_BASE_PATH, ROADMAPS_PATH } from "@/lib/paths"

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
  if (role !== "admin" && role !== "super-admin") redirect(FORBIDDEN_PATH)

  return (
    <RoadmapViewer
      slug={slug}
      isAuthenticated
      backHref={ROADMAPS_PATH}
      readOnlyBadge
      // Admins author content: internal articles open the EDITORS here
      // (jupyter → /notebooks, notion → the admin /notion zone), not the web
      // read-only surfaces.
      notebookBasePath="/notebooks"
      notionBasePath={NOTION_BASE_PATH}
    />
  )
}
