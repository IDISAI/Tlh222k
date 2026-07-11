"use client"

import { useMemo, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

import type { CallerRole, RoadmapNode } from "../../types"
import { useBuilderCanvas } from "../hooks/use-builder-canvas"
import { NODE_TYPE_ACCENT, NODE_TYPE_ICONS } from "../utils/node-type-styles"
import { BuilderCanvas } from "./BuilderCanvas"
import { NodeDetailDialog } from "./NodeDetailDialog"

interface ChapterDetailPageProps {
  roadmapId: string
  chapterSlug: string
  role: CallerRole
  /** Back link — the parent roadmap builder. */
  builderHref: string
  onNodeTitleSync?: (slug: string, title: string) => void | Promise<void>
  onCreateNotionDoc?: (
    slug: string,
    title: string
  ) => Promise<{ id: string } | null>
  onSyncPublish?: (notionPageId: string, isPublished: boolean) => Promise<void>
}

/**
 * Roadmap_Detail_Page for ONE chapter (notion-article-node Req 10): left
 * sidebar lists the chapter's direct children, the center canvas shows the
 * chapter node plus those children only (depth=1), and selecting a node opens
 * the same right-side NodeDetailDialog the builder uses. Double-clicking a
 * notion article inherits the Req 1 auto-navigate behavior via BuilderCanvas.
 */
export function ChapterDetailPage({
  roadmapId,
  chapterSlug,
  role,
  builderHref,
  onNodeTitleSync,
  onCreateNotionDoc,
  onSyncPublish,
}: ChapterDetailPageProps) {
  const canvas = useBuilderCanvas(
    roadmapId,
    role,
    onNodeTitleSync,
    onCreateNotionDoc
  )
  const [selected, setSelected] = useState<RoadmapNode | null>(null)

  const chapter = useMemo(
    () =>
      canvas.nodes.find(
        (n) => n.nodeType === "chapter" && n.slug === chapterSlug && !n.isDeleted
      ) ?? null,
    [canvas.nodes, chapterSlug]
  )

  // Req 10.2: chapter + its DIRECT children only (depth=1).
  const subsetNodes = useMemo(() => {
    if (!chapter) return []
    return canvas.nodes.filter(
      (n) => n.id === chapter.id || n.parentId === chapter.id
    )
  }, [canvas.nodes, chapter])

  const children = useMemo(
    () => subsetNodes.filter((n) => n.parentId === chapter?.id && !n.isDeleted),
    [subsetNodes, chapter]
  )

  // The canvas api is shared; only the RENDERED node set is narrowed. Lookups
  // (parent chapter slug, drag/drop guards) still see the whole roadmap via
  // nodesRef.
  const chapterCanvas = useMemo(
    () => ({ ...canvas, nodes: subsetNodes }),
    [canvas, subsetNodes]
  )

  if (role !== "admin" && role !== "super-admin") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          Bạn không có quyền truy cập trang này.
        </p>
      </div>
    )
  }

  if (canvas.loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[60svh] w-full" />
      </div>
    )
  }

  // Req 10.7: unknown chapter slug → error with a way back to the builder.
  if (canvas.notFound || !chapter) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold">Không tìm thấy chapter</p>
        <p className="text-sm text-muted-foreground">
          Chapter <code className="rounded bg-muted px-1.5 py-0.5">{chapterSlug}</code>{" "}
          không tồn tại trong roadmap này.
        </p>
        <Button nativeButton={false} render={<a href={builderHref} />}>
          <ArrowLeft className="size-4" /> Quay về Builder
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100svh-57px)] flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <a
          href={builderHref}
          className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Builder
        </a>
        <span className="text-muted-foreground">/</span>
        <h1 className="min-w-0 truncate text-lg font-extrabold uppercase italic">
          {chapter.title}
        </h1>
        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          chapter
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Req 10.3: left sidebar — the chapter's direct children. */}
        <aside className="flex w-64 shrink-0 flex-col border-r bg-background">
          <p className="border-b p-3 text-xs font-semibold uppercase text-muted-foreground">
            Node con ({children.length})
          </p>
          <div className="flex-1 overflow-y-auto p-2">
            {children.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">
                Chưa có node con — chuột phải lên canvas để tạo.
              </p>
            ) : (
              children.map((node) => {
                const Icon = NODE_TYPE_ICONS[node.nodeType]
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelected(node)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                      selected?.id === node.id && "bg-muted font-medium"
                    )}
                  >
                    <Icon
                      className={cn("size-4 shrink-0", NODE_TYPE_ACCENT[node.nodeType])}
                    />
                    <span className="min-w-0 flex-1 truncate">{node.title}</span>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <BuilderCanvas
          canvas={chapterCanvas}
          className="h-full min-w-0 flex-1"
          onSyncPublish={onSyncPublish}
        />
      </div>

      {/* Req 10.3: right sidebar — properties of the selected node. */}
      <NodeDetailDialog
        node={selected}
        nodes={canvas.nodes}
        onClose={() => setSelected(null)}
        builderBasePath="/roadmaps"
      />
    </div>
  )
}
