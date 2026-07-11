"use client"

import { AlertTriangle, Eraser, ExternalLink, PencilLine } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { toast } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"

import type { RoadmapNode } from "../../types"
import { resolveArticleTarget } from "../../utils/resolve-article-target"
import { NODE_TYPE_ACCENT, NODE_TYPE_ICONS } from "../utils/node-type-styles"
import { TOAST_MESSAGES } from "../utils/toast-messages"
import { childrenOf } from "./builder-context"

interface NodeDetailDialogProps {
  node: RoadmapNode | null
  nodes: RoadmapNode[]
  onClose: () => void
  /** Omitted / ignored in read-only (viewer) mode. */
  onEdit?: (node: RoadmapNode) => void
  /** Canvas "delete" only takes the node off the canvas → back to Kho Node. */
  onRemoveFromCanvas?: (node: RoadmapNode) => void
  /** Viewer mode: hide the edit / remove actions, keep only "Điều hướng". */
  readOnly?: boolean
  /**
   * Base path for INTERNAL Jupyter articles. Web (viewers) → "/learn"
   * (read-only viewer); admin/super-admin (creators) → "/notebooks" (editor).
   */
  notebookBasePath?: string
  /**
   * Base path for INTERNAL Notion articles. Both zones route to "/notion" —
   * web renders the read-only workspace, admin the editor (admin may pass a
   * zone-prefixed path in production).
   */
  notionBasePath?: string
}

/**
 * Resolve the destination the "Điều hướng" action opens (Req 7.4/7.5).
 * role/skill → a same-origin `/roadmap/[slug]` viewer, so admin stays on :3002
 * and web stays on :3000 (each zone owns its own viewer route).
 *
 * The base paths decide where INTERNAL articles go and differ by zone: web
 * gets the read-only surfaces (`/learn`, `/notion`), admin/super-admin get
 * the editors (`/notebooks`, `/notion` in the admin zone).
 */
export function nodeNavigationUrl(
  node: RoadmapNode,
  notebookBasePath = "/learn",
  notionBasePath = "/notion"
): string | null {
  if (
    node.nodeType === "role" ||
    node.nodeType === "skill" ||
    node.nodeType === "chapter"
  ) {
    return `/roadmap/${node.slug}`
  }
  if (node.nodeType === "article") {
    const target = resolveArticleTarget(node)
    if (target) {
      if (target.kind === "external") return target.url
      const basePath =
        node.articleType === "notion" ? notionBasePath : notebookBasePath
      return `${basePath}/${target.slug}`
    }
  }
  return null
}

/**
 * NodeDetail panel — full node info shown as a right-side slide-in sidebar (not
 * a centered dialog) on double-click, with the three actions Chỉnh sửa / Xóa /
 * Điều hướng (Req 7). Matches the viewer's right-drawer pattern so the builder
 * and the viewer feel like one product.
 */
export function NodeDetailDialog({
  node,
  nodes,
  onClose,
  onEdit,
  onRemoveFromCanvas,
  readOnly = false,
  notebookBasePath = "/learn",
  notionBasePath = "/notion",
}: NodeDetailDialogProps) {
  if (!node) return null

  const Icon = NODE_TYPE_ICONS[node.nodeType]
  const parent = node.parentId
    ? (nodes.find((n) => n.id === node.parentId) ?? null)
    : null
  const childCount = childrenOf(nodes, node.id).length
  const navUrl = nodeNavigationUrl(node, notebookBasePath, notionBasePath)
  const isArticle = node.nodeType === "article"
  const canNavigate = navUrl !== null
  // Same-origin routes (role/skill, internal notebook/notion) stay in this
  // zone; only absolute URLs (legacy external docs) open in a new tab.
  const isExternal = navUrl !== null && /^https?:\/\//.test(navUrl)

  const handleNavigate = () => {
    // Req 7.6: unlinked article documents warn instead of navigating.
    if (!navUrl) {
      toast.warning(TOAST_MESSAGES.ARTICLE_NO_LINK)
      return
    }
    if (isExternal) {
      window.open(navUrl, "_blank", "noopener,noreferrer")
    } else {
      window.location.assign(navUrl)
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(open: boolean) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        side="right"
        showOverlay={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[420px]"
      >
        <SheetHeader className="border-b dark:border-zinc-800">
          <SheetTitle className="flex items-center gap-2">
            <Icon className={cn("size-4", NODE_TYPE_ACCENT[node.nodeType])} />
            <span className="min-w-0 truncate">{node.title}</span>
            <Badge variant="secondary">{node.nodeType}</Badge>
            {isArticle && node.articleType && (
              <Badge variant="outline">{node.articleType}</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-6 text-sm">
          {node.description && (
            <div className="space-y-1">
              <Label>Mô tả</Label>
              <p className="text-muted-foreground">{node.description}</p>
            </div>
          )}

          {isArticle && (
            <div className="space-y-1">
              <Label>Tài liệu</Label>
              {navUrl ? (
                <a
                  href={navUrl}
                  {...(isExternal
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="block truncate text-xs text-primary underline underline-offset-2"
                >
                  {navUrl}
                </a>
              ) : (
                <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="size-3.5" /> Chưa được liên kết
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <p>
              Node cha:{" "}
              <span className="font-medium text-foreground">
                {parent ? parent.title : "—"}
              </span>
            </p>
            <p>
              Node con:{" "}
              <span className="font-medium text-foreground">{childCount}</span>
            </p>
          </div>
        </div>

        <SheetFooter className="border-t dark:border-zinc-800">
          <Button
            type="button"
            disabled={isArticle ? false : !canNavigate}
            title={
              !navUrl && isArticle ? "Tài liệu chưa được liên kết" : undefined
            }
            onClick={handleNavigate}
          >
            <ExternalLink className="size-4" /> Điều hướng
          </Button>
          {!readOnly && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onClose()
                  onEdit?.(node)
                }}
              >
                <PencilLine className="size-4" /> Chỉnh sửa
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  // Canvas delete = remove from canvas (node returns to Kho
                  // Node). Permanent deletion lives only in the sidebar.
                  onClose()
                  onRemoveFromCanvas?.(node)
                }}
              >
                <Eraser className="size-4" /> Xóa khỏi Canvas
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
