import { permanentRedirect } from "next/navigation"

// Legacy singular route. The access contract names `/roadmaps/[slug]` as the
// canonical public URL, so this only forwards — it must not render the viewer
// itself, or the same roadmap would be reachable at two live URLs.
export default async function LegacyRoadmapDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  permanentRedirect(`/roadmaps/${encodeURIComponent(slug)}`)
}
