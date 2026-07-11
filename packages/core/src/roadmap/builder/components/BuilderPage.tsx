"use client"

import { useMemo, useState } from "react"
import { ArrowLeft, PanelLeftOpen, Redo2, Save, Trash2, Undo2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { toast } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"

import type { CallerRole } from "../../types"
import { useBuilderCanvas } from "../hooks/use-builder-canvas"
import { BuilderCanvas } from "./BuilderCanvas"
import { DeleteRoadmapDialog } from "./DeleteRoadmapDialog"
import { NodeSidebar } from "./NodeSidebar"

interface BuilderPageProps {
  roadmapId: string
  role: CallerRole
  /** Back link target — the admin roadmap list. */
  listHref?: string
  /**
   * Cross-service title sync (QĐ-2): renaming a node backing a notion doc
   * pushes the new title to that Document by slug. Injected as a Server Action
   * by the admin page (web omits it — read-only).
   */
  onNodeTitleSync?: (slug: string, title: string) => void | Promise<void>
  /** Auto-create the Document for a new notion article node (Req 2). */
  onCreateNotionDoc?: (
    slug: string,
    title: string
  ) => Promise<{ id: string } | null>
  /** Publish-state sync with the linked Document (Req 7). */
  onSyncPublish?: (notionPageId: string, isPublished: boolean) => Promise<void>
  /** Archive the linked Document on permanent node delete (Req 8.2). */
  onArchiveDocument?: (notionPageId: string) => Promise<void>
}

/**
 * Builder screen (Req 1.1): toolbar (Lưu / Xóa roadmap / xuất bản), editable
 * canvas on the left, node sidebar on the right. All data is fetched
 * client-side so the localStorage-backed mock store stays authoritative.
 */
export function BuilderPage({
  roadmapId,
  role,
  listHref = "/roadmaps",
  onNodeTitleSync,
  onCreateNotionDoc,
  onSyncPublish,
  onArchiveDocument,
}: BuilderPageProps) {
  const canvas = useBuilderCanvas(
    roadmapId,
    role,
    onNodeTitleSync,
    onCreateNotionDoc
  )
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const canvasNodeIds = useMemo(
    () => new Set(canvas.nodes.map((n) => n.id)),
    [canvas.nodes]
  )

  // Defense in depth — the admin proxy + page gate should never let this hit.
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

  if (canvas.notFound || !canvas.roadmap) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold">Không tìm thấy roadmap</p>
        <Button nativeButton={false} render={<a href={listHref} />}>
          <ArrowLeft className="size-4" /> Về danh sách Roadmap
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100svh-57px)] flex-col">
      <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <a
            href={listHref}
            className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Danh sách Roadmap
          </a>
          <span className="text-muted-foreground">/</span>
          <h1 className="min-w-0 truncate text-lg font-extrabold uppercase italic">
            {canvas.roadmap.title}
          </h1>
          <button
            type="button"
            onClick={() => void canvas.togglePublish()}
            title="Bật/tắt xuất bản"
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:bg-muted",
              canvas.roadmap.isPublished
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                canvas.roadmap.isPublished ? "bg-emerald-500" : "bg-zinc-400"
              )}
            />
            {canvas.roadmap.isPublished ? "đã xuất bản" : "chưa xuất bản"}
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            title="Hoàn tác (Ctrl+Z)"
            disabled={!canvas.canUndo}
            onClick={() => canvas.undo()}
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            title="Làm lại (Ctrl+Shift+Z)"
            disabled={!canvas.canRedo}
            onClick={() => canvas.redo()}
          >
            <Redo2 className="size-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canvas.isDirty || canvas.isSaving}
            onClick={() => void canvas.save()}
          >
            <Save className="size-4" />
            {canvas.isSaving ? "Đang lưu..." : "Lưu"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" /> Xóa roadmap
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar on the LEFT with collapse toggle (item: nút toggle). */}
        {sidebarOpen ? (
          <NodeSidebar
            allNodes={canvas.allNodes}
            canvasNodeIds={canvasNodeIds}
            onDeletePermanent={async (node) => {
              const ok = await canvas.deleteNodePermanent(node.id)
              // Req 8.2-8.4: node deleted FIRST, then the linked Document is
              // archived; an archive failure never undoes the delete.
              if (
                ok &&
                node.articleType === "notion" &&
                node.notionPageId &&
                onArchiveDocument
              ) {
                await onArchiveDocument(node.notionPageId).catch((error) => {
                  console.error(
                    "[notion-article-node] document archive failed",
                    { nodeId: node.id, notionPageId: node.notionPageId, error }
                  )
                  toast.warning(
                    "Node đã xóa nhưng không thể archive Notion page."
                  )
                })
              }
            }}
            onCollapse={() => setSidebarOpen(false)}
          />
        ) : (
          <div className="flex w-10 shrink-0 flex-col items-center border-r bg-background pt-3">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Mở Kho Node"
              onClick={() => setSidebarOpen(true)}
            >
              <PanelLeftOpen className="size-4" />
            </Button>
          </div>
        )}
        <BuilderCanvas
          canvas={canvas}
          className="h-full min-w-0 flex-1"
          onSyncPublish={onSyncPublish}
        />
      </div>

      {confirmDelete && (
        <DeleteRoadmapDialog
          roadmap={canvas.roadmap}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            const ok = await canvas.deleteRoadmap()
            setConfirmDelete(false)
            if (ok) window.location.href = listHref
          }}
        />
      )}
    </div>
  )
}
