import { notFound } from "next/navigation"
import { RoadmapService } from "@workspace/core"

import { getIsAuthenticated } from "@/lib/auth"
import { RoadmapDetailClient } from "./roadmap-detail-client"

const service = new RoadmapService()

export default async function RoadmapDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const isAuthenticated = await getIsAuthenticated()

  const graph = await service.graphBySlug(slug, {
    authenticated: isAuthenticated,
  })
  if (!graph) notFound()

  return (
    <RoadmapDetailClient graph={graph} isAuthenticated={isAuthenticated} />
  )
}
