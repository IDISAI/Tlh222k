import { Lock } from "lucide-react"
import { notFound } from "next/navigation"
import { RoadmapService, RoadmapServiceError, RoadmapViewer } from "@workspace/core"

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

  // LEGO per-block viewer: the home cards link by block NODE id, so resolve the
  // block's single-level composition first; fall back to the legacy roadmap/
  // node-slug graph so old links keep working.
  let graph
  try {
    graph =
      (await service.publicBlockGraph(slug)) ??
      (await service.graphBySlug(slug, { authenticated: isAuthenticated }))
  } catch (error) {
    // An Internal block refuses a caller who lacks AIO access. That is a real
    // answer, not an absent one — show it rather than folding it into the
    // generic "doesn't exist" 404, which would tell a refused viewer they
    // followed a broken link when the block is right there, just closed to them.
    if (
      error instanceof RoadmapServiceError &&
      error.code === "PERMISSION_DENIED"
    ) {
      return <InternalBlockRefused />
    }
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

function InternalBlockRefused() {
  return (
    <div className="mx-auto flex min-h-[60svh] w-full max-w-lg flex-col items-center justify-center gap-3 px-4 text-center">
      <Lock className="size-9 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Nội dung dành cho học viên AIO</h1>
      <p className="text-sm text-muted-foreground">
        Roadmap này chỉ mở cho học viên AIO. Nếu bạn đã đăng ký, hãy đăng nhập
        bằng tài khoản AIO của mình.
      </p>
      <a
        href="/roadmaps"
        className="text-sm font-medium text-primary underline underline-offset-2"
      >
        Quay lại danh sách roadmap
      </a>
    </div>
  )
}
