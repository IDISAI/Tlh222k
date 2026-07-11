import { FileText } from "lucide-react"

import { NotionWorkspace } from "@workspace/core"
import { NotionService } from "@workspace/core/notion/notion.service"

import { getById, getChildren } from "../actions"

// Content is edited live in the admin zone — never serve a stale cache.
export const dynamic = "force-dynamic"

const service = new NotionService()

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const doc = await service.getBySlug("viewer", slug)
  return { title: doc?.title ?? "Tài liệu" }
}

/**
 * Public read-only Notion workspace for a roadmap "notion" article slug.
 * Renders the SAME `NotionWorkspace` the admin editor uses (canEdit=false):
 * published pages only; unpublished/missing roots get the "chưa sẵn sàng"
 * screen (mirrors the /learn NotebookNotReady precedent).
 */
export default async function NotionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { slug } = await params
  const { page } = await searchParams
  // "viewer" on purpose: the web zone is published-only for every role.
  const doc = await service.getBySlug("viewer", slug)

  if (!doc) return <NotionNotReady slug={slug} />

  // Deep-link to a published article page under this chapter (read-only).
  // A ?page= that resolves to nothing published shows the "không khả dụng"
  // screen instead of silently falling back to other content
  // (notion-article-node Req 6.5).
  let initialSelectedId: string | undefined
  if (page && page !== slug) {
    const pageDoc = await service.getBySlug("viewer", page)
    if (!pageDoc) return <NotionNotReady slug={page} />
    initialSelectedId = pageDoc.id
  }

  return (
    <NotionWorkspace
      root={doc}
      canEdit={false}
      initialSelectedId={initialSelectedId}
      actions={{ getById, getChildren }}
    />
  )
}

function NotionNotReady({ slug }: { slug: string }) {
  return (
    <div className="mx-auto flex min-h-[60svh] w-full max-w-lg flex-col items-center justify-center gap-3 px-4 text-center">
      <FileText className="size-9 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Nội dung không khả dụng</h1>
      <p className="text-sm text-muted-foreground">
        Tài liệu{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">{slug}</code> chưa có
        nội dung được xuất bản. Nội dung sẽ xuất hiện khi được soạn và xuất bản
        trong trình soạn thảo (admin).
      </p>
      <a
        href="/roadmaps"
        className="text-sm font-medium text-primary underline underline-offset-2"
      >
        ← Quay lại danh sách roadmap
      </a>
    </div>
  )
}
