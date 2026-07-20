"use client"

import { useMemo, useState } from "react"
import { ArrowLeft, Check, Copy, Globe, PanelLeftOpen, Redo2, Trash2, Undo2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"

import type { CallerRole } from "../../types"
import { useCompositionCanvas } from "../hooks/use-composition-canvas"
import { CompositionCanvas } from "./CompositionCanvas"
import { DeleteNodeDialog } from "./DeleteNodeDialog"
import { NodeSidebar } from "./NodeSidebar"

interface BuilderPageProps {
  /** The owner block whose composition canvas this page shows (a block IS a roadmap). */
  nodeId: string
  role: CallerRole
  /** Back link target — the admin roadmap list. */
  listHref?: string
  /** Public origin to generate copy link (e.g. http://localhost:3000) */
  publicOrigin?: string
  /** Rename → linked Notion doc title sync (reserved; wired for articles later). */
  onNodeTitleSync?: (slug: string, title: string) => void | Promise<void>
  onCreateNotionDoc?: (
    slug: string,
    title: string,
    parentChapterSlug?: string
  ) => Promise<{ id: string } | null>
  onSyncPublish?: (notionPageId: string, isPublished: boolean) => Promise<void>
  onArchiveDocument?: (notionPageId: string) => Promise<void>
}

/**
 * Roadmap detail (LEGO model): one owner block's composition canvas. Left =
 * Kho Roadmap sidebar (role/skill blocks, drag onto the canvas), center =
 * composition canvas (owner pinned on top + member blocks + edges), right =
 * node detail / edit slide-ins (rendered inside the canvas).
 */
export function BuilderPage({
  nodeId,
  role,
  listHref = "/roadmaps",
  publicOrigin,
  onCreateNotionDoc,
  onSyncPublish,
}: BuilderPageProps) {
  const canvas = useCompositionCanvas(nodeId, role, { onCreateNotionDoc, onSyncPublish })
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copied, setCopied] = useState(false)

  // Blocks already on this canvas (owner + members) get an active border in the
  // sidebar instead of being hidden.
  const canvasNodeIds = useMemo(
    () => new Set<string>([nodeId, ...canvas.memberNodes.map((m) => m.node.id)]),
    [nodeId, canvas.memberNodes]
  )

  // Drill base for the detail panel — strip the current id segment so drilling
  // works via the multi-zone host (/admin/roadmaps/...) or the direct domain.
  const builderBasePath = useMemo(() => {
    if (typeof window === "undefined") return listHref
    return window.location.pathname.replace(/\/[^/]+\/?$/, "") || listHref
  }, [listHref])

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

  if (canvas.notFound || !canvas.ownerNode) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold">Không tìm thấy roadmap</p>
        <Button nativeButton={false} render={<a href={listHref} />}>
          <ArrowLeft className="size-4" /> Về danh sách Roadmap
        </Button>
      </div>
    )
  }

  const owner = canvas.ownerNode
  const publicUrl = publicOrigin && owner ? `${publicOrigin}/roadmap/${owner.slug}` : null

  const copyPublicUrl = () => {
    if (!publicUrl) return
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
            {owner.title}
          </h1>
          <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
            {owner.nodeType}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            title="Undo (Ctrl+Z)"
            disabled={!canvas.canUndo}
            onClick={() => void canvas.undo()}
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            title="Redo (Ctrl+Y)"
            disabled={!canvas.canRedo}
            onClick={() => void canvas.redo()}
          >
            <Redo2 className="size-4" />
          </Button>
          <div className="mx-1 h-5 w-px bg-border" />
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  size="sm"
                  variant={owner.isPublished ? "secondary" : "outline"}
                >
                  {owner.isPublished ? (
                    <>
                      <Globe className="size-4 text-sky-500" />
                      <span className="text-sky-500">Đã xuất bản</span>
                    </>
                  ) : (
                    <>
                      <Globe className="size-4" />
                      <span>Chưa xuất bản</span>
                    </>
                  )}
                </Button>
              }
            />
            <PopoverContent className="w-80" align="end">
              {owner.isPublished ? (
                <div className="space-y-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-sky-500">
                    <Globe className="size-3.5" />
                    Trang này đang công khai trên web.
                  </p>
                  {publicUrl && (
                    <div className="flex items-center">
                      <input
                        readOnly
                        value={publicUrl}
                        className="h-8 flex-1 truncate rounded-l-md border bg-muted px-2 text-xs outline-none"
                      />
                      <Button
                        size="icon-sm"
                        variant="outline"
                        className="rounded-l-none"
                        onClick={copyPublicUrl}
                      >
                        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                      </Button>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      void canvas.updateNodeMeta(owner.id, {
                        isPublished: false,
                      })
                    }
                  >
                    Hủy xuất bản
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 text-center">
                  <Globe className="mx-auto size-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Xuất bản trang này</p>
                  <p className="text-xs text-muted-foreground">
                    Khách truy cập web sẽ xem được nội dung (chỉ đọc).
                  </p>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      void canvas.updateNodeMeta(owner.id, {
                        isPublished: true,
                      })
                    }
                  >
                    Xuất bản
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
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
        {sidebarOpen ? (
          <NodeSidebar
            allNodes={canvas.allNodes}
            canvasNodeIds={canvasNodeIds}
            onDeletePermanent={async (node) => {
              await canvas.deleteBlockPermanent(node.id)
            }}
            onCollapse={() => setSidebarOpen(false)}
          />
        ) : (
          <div className="flex w-10 shrink-0 flex-col items-center border-r bg-background pt-3">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Mở Kho Roadmap"
              onClick={() => setSidebarOpen(true)}
            >
              <PanelLeftOpen className="size-4" />
            </Button>
          </div>
        )}
        <CompositionCanvas
          canvas={canvas}
          builderBasePath={builderBasePath}
          className={cn("h-full min-w-0 flex-1")}
          onSyncPublish={onSyncPublish}
        />
      </div>

      {confirmDelete && (
        <DeleteNodeDialog
          node={owner}
          childCount={canvas.memberNodes.length}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            const ok = await canvas.deleteBlockPermanent(owner.id)
            setConfirmDelete(false)
            if (ok) window.location.href = listHref
          }}
        />
      )}
    </div>
  )
}
