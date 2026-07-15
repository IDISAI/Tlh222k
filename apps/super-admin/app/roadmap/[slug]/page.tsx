import { redirect } from "next/navigation"
import { RoadmapViewer } from "@workspace/core"

import { getRole } from "@/lib/auth"
import { USERS_PATH } from "@/lib/paths"

export const dynamic = "force-dynamic"

export default async function SuperAdminRoadmapPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  if ((await getRole()) !== "super-admin") redirect(USERS_PATH)
  return (
    <RoadmapViewer
      slug={slug}
      isAuthenticated
      backHref={USERS_PATH}
      readOnlyBadge
      notebookBasePath="/notebooks"
    />
  )
}
