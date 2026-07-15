import { redirect } from "next/navigation"
import { ChapterDetailPage } from "@workspace/core"

import { getRole } from "@/lib/auth"
import { FORBIDDEN_PATH } from "@/lib/paths"
import {
  createDocumentForNode,
  syncPublishByNotionPageId,
  syncTitleBySlug,
} from "@/app/notion/actions"

export const metadata = { title: "Chapter detail" }

/**
 * Roadmap_Detail_Page for one chapter (notion-article-node Req 10): left
 * sidebar with the chapter's children, depth-1 canvas, right properties panel.
 * Reached from the chapter node's "Điều hướng" action in the builder.
 */
export default async function ChapterDetailRoute({
  params,
}: {
  params: Promise<{ id: string; slug: string }>
}) {
  const { id, slug } = await params
  const role = await getRole()
  if (role !== "admin" && role !== "super-admin") redirect(FORBIDDEN_PATH)

  return (
    <ChapterDetailPage
      roadmapId={id}
      chapterSlug={slug}
      role={role}
      builderHref={`/roadmaps/${id}`}
      onNodeTitleSync={syncTitleBySlug}
      onCreateNotionDoc={createDocumentForNode}
      onSyncPublish={syncPublishByNotionPageId}
    />
  )
}
