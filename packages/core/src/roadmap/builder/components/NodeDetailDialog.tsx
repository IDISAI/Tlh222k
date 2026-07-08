"use client"

import { AlertTriangle, Eraser, ExternalLink, PencilLine } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Label } from "@workspace/ui/components/label"
import { toast } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"

import type { RoadmapNode } from "../../types"
import { NODE_TYPE_ACCENT, NODE_TYPE_ICONS } from "../utils/node-type-styles"
import { TOAST_MESSAGES } from "../utils/toast-messages"
import { childrenOf } from "./builder-context"

interface NodeDetailDialogProps {
  node: RoadmapNode | null
  nodes: RoadmapNode[]
  /** Web_App origin for role/skill detail links ("" = same origin). */
  webBaseUrl: string
  onClose: () => void
  onEdit: (node: RoadmapNode) => void
  /** Canvas "delete" only takes the node off the canvas → back to Kho Node. */
  onRemoveFromCanvas: (node: RoadmapNode) => void
}

/** Resolve the destination the "Điều hướng" action opens (Req 7.4/7.5). */
export function nodeNavigationUrl(
  node: RoadmapNode,
  webBaseUrl: string
): string | null {
  if (node.nodeType === "role" || node.nodeType === "skill") {
    return `${webBaseUrl}/roadmap/${node.slug}`
  }
  if (node.nodeType === "article") {
    if (node.articleType === "notion" && node.notionPageId) {
      return `https://notion.so/${node.notionPageId}`
    }
    if (node.articleType === "jupyter" && node.jupyterUrl) {
      return node.jupyterUrl
    }
  }
  return null
}

/**
 * NodeDetail_Dialog — full node info on double-click with the three actions
 * Chỉnh sửa / Xóa / Điều hướng (Req 7).
 */
export function NodeDetailDialog({
  node,
  nodes,
  webBaseUrl,
  onClose,
  onEdit,
  onRemoveFromCanvas,
}: NodeDetailDialogProps) {
  if (!node) return null

  const Icon = NODE_TYPE_ICONS[node.nodeType]
  const parent = node.parentId
    ? (nodes.find((n) => n.id === node.parentId) ?? null)
    : null
  const childCount = childrenOf(nodes, node.id).length
  const navUrl = nodeNavigationUrl(node, webBaseUrl)
  const isArticle = node.nodeType === "article"
  const canNavigate = navUrl !== null && node.nodeType !== "chapter"

  const handleNavigate = () => {
    // Req 7.6: unlinked article documents warn instead of navigating.
    if (!navUrl) {
      toast.warning(TOAST_MESSAGES.ARTICLE_NO_LINK)
      return
    }
    window.open(navUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <Dialog
      open
      onOpenChange={(open: boolean) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn("size-4", NODE_TYPE_ACCENT[node.nodeType])} />
            <span className="min-w-0 truncate">{node.title}</span>
            <Badge variant="secondary">{node.nodeType}</Badge>
            {isArticle && node.articleType && (
              <Badge variant="outline">{node.articleType}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
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
                  target="_blank"
                  rel="noopener noreferrer"
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

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onClose()
              onEdit(node)
            }}
          >
            <PencilLine className="size-4" /> Chỉnh sửa
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              // Canvas delete = remove from canvas (node returns to Kho Node).
              // Permanent deletion lives only in the sidebar.
              onClose()
              onRemoveFromCanvas(node)
            }}
          >
            <Eraser className="size-4" /> Xóa khỏi Canvas
          </Button>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
