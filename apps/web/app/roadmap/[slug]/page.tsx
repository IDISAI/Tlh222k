import { notFound } from "next/navigation"
import { RoadmapService, RoadmapViewer } from "@workspace/core"

import { getIsAuthenticated } from "@/lib/auth"

// Always render fresh: the roadmap's published state and nodes are edited in
// the admin CMS, so this route must never be served from a stale cache.
export const dynamic = "force-dynamic"

const service = new RoadmapService()

export default async function RoadmapDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const isAuthenticated = await getIsAuthenticated()

  let graph
  try {
    graph = await service.graphBySlug(slug, { authenticated: isAuthenticated })
  } catch {
    // svc-api unreachable (e.g. Vercel deployment protection, cold-start timeout)
    notFound()
  }
  if (!graph) notFound()

  return (
    <RoadmapViewer
      slug={slug}
      isAuthenticated={isAuthenticated}
      initialGraph={graph}
      backHref="/roadmaps"
    />
  )
}
