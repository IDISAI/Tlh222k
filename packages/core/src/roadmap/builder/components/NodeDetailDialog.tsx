"use client"

import { useEffect, useState } from "react"
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
}

/**
 * Resolve the destination the "Điều hướng" action opens (Req 7.4/7.5).
 * role/skill → a same-origin `/roadmap/[slug]` viewer, so admin stays on :3002
 * and web stays on :3000 (each zone owns its own viewer route).
 *
 * `notebookBasePath` decides where an INTERNAL Jupyter article goes and differs
 * by zone: web (viewers) → `/learn` (read-only viewer); admin/super-admin
 * (creators) → `/notebooks` (the editor, to create/update that notebook).
 */
export function nodeNavigationUrl(
  node: RoadmapNode,
  notebookBasePath = "/notebooks"
): string | null {
  if (node.nodeType === "role" || node.nodeType === "skill") {
    return `/roadmap/${node.slug}`
  }
  if (node.nodeType === "article") {
    const target = resolveArticleTarget(node)
    if (target) {
      return target.kind === "external"
        ? target.url
        : `${notebookBasePath}/${target.slug}`
    }
  }
  return null
}

/** Host rewrites remove zone prefixes before child Next apps render. */
export function zoneAwareNodeNavigationUrl(
  node: RoadmapNode,
  notebookBasePath: string,
  pathname: string
): string | null {
  const zone = pathname === "/admin" || pathname.startsWith("/admin/")
    ? "/admin"
    : pathname === "/super-admin" || pathname.startsWith("/super-admin/")
      ? "/super-admin"
      : ""
  const base = zone && !notebookBasePath.startsWith(`${zone}/`)
    ? `${zone}${notebookBasePath}`
    : notebookBasePath
  const target = nodeNavigationUrl(node, base)
  if (!zone || !target?.startsWith("/") || target.startsWith(`${zone}/`)) {
    return target
  }
  return `${zone}${target}`
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
  notebookBasePath = "/notebooks",
}: NodeDetailDialogProps) {
  const [pathname, setPathname] = useState<string | null>(null)

  useEffect(() => {
    setPathname(window.location.pathname)
  }, [])

  if (!node) return null

  const Icon = NODE_TYPE_ICONS[node.nodeType]
  const parent = node.parentId
    ? (nodes.find((n) => n.id === node.parentId) ?? null)
    : null
  const childCount = childrenOf(nodes, node.id).length
  const navUrl = nodeNavigationUrl(node, notebookBasePath)
  const resolvedNavUrl = pathname
    ? (zoneAwareNodeNavigationUrl(node, notebookBasePath, pathname) ?? navUrl)
    : navUrl
  const isArticle = node.nodeType === "article"
  const canNavigate = navUrl !== null && node.nodeType !== "chapter"
  // Same-origin routes (role/skill, internal notebook) stay in this zone;
  // only Notion targets open as external links in a new tab.
  const isExternal =
    isArticle && node.articleType === "notion" && navUrl !== null

  const handleNavigate = () => {
    // Req 7.6: unlinked article documents warn instead of navigating.
    if (!navUrl) {
      toast.warning(TOAST_MESSAGES.ARTICLE_NO_LINK)
      return
    }
    if (isExternal) {
      window.open(navUrl, "_blank", "noopener,noreferrer")
    } else {
      window.location.assign(
        zoneAwareNodeNavigationUrl(node, notebookBasePath, window.location.pathname) ?? navUrl
      )
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
              {resolvedNavUrl ? (
                <a
                  href={resolvedNavUrl}
                  {...(isExternal
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="block truncate text-xs text-primary underline underline-offset-2"
                >
                  {resolvedNavUrl}
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
