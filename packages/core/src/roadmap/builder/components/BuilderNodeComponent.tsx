"use client"

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import { createPortal } from "react-dom"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { AlertTriangle, FileText, ImageIcon, NotebookText } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

import type { BuilderFlowNode } from "../types"
import { LEVEL_LABELS } from "../../level"
import { useBuilderCanvasContext } from "./builder-context"
import { HoverPreview } from "./HoverPreview"

/** Hover intent timings (Req 5.1/5.2/5.6). */
const SHOW_DELAY_MS = 300
const HIDE_GRACE_MS = 100
const PREVIEW_WIDTH = 360

/** Place the preview beside the node, flipping/clamping to stay in the viewport. */
function computePreviewStyle(rect: DOMRect): CSSProperties {
  const gap = 12
  let left = rect.right + gap
  if (left + PREVIEW_WIDTH > window.innerWidth - 8) {
    left = rect.left - PREVIEW_WIDTH - gap
  }
  left = Math.max(8, left)
  const top = Math.max(8, Math.min(rect.top, window.innerHeight - 380))
  return { left, top }
}

/**
 * Editable canvas node: neo-brutalist card colored by NodeType, with hover
 * preview, article link badges and the Disabled_Node ghost state (Req 4.4).
 */
export const BuilderNodeComponent = memo(function BuilderNodeComponent({
  data,
  selected,
}: NodeProps<BuilderFlowNode>) {
  const { node, viewerMode, isOwner, isRequired = true } = data
  const { nodes, isDragging } = useBuilderCanvasContext()

  const cardRef = useRef<HTMLDivElement | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewStyle, setPreviewStyle] = useState<CSSProperties | null>(null)
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (showTimer.current) clearTimeout(showTimer.current)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    },
    []
  )

  // Keep the fixed-position preview glued to the node while the canvas pans,
  // zooms or the node is dragged — recompute its anchor every frame off the
  // live DOM rect so it moves WITH the node instead of detaching.
  useEffect(() => {
    if (!showPreview) return
    let raf = 0
    const tick = () => {
      const rect = cardRef.current?.getBoundingClientRect()
      if (rect) setPreviewStyle(computePreviewStyle(rect))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [showPreview])

  const cancelTimers = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    showTimer.current = null
    hideTimer.current = null
  }, [])

  const handleEnter = useCallback(() => {
    if (node.isDeleted || isDragging) return
    cancelTimers()
    showTimer.current = setTimeout(() => {
      const rect = cardRef.current?.getBoundingClientRect()
      if (rect) setPreviewStyle(computePreviewStyle(rect))
      setShowPreview(true)
    }, SHOW_DELAY_MS)
  }, [node.isDeleted, isDragging, cancelTimers])

  // Grace period: moving into the preview within 100ms keeps it open; the
  // preview itself then hides ≤150ms after the pointer leaves it (Req 5.2).
  const handleLeave = useCallback(() => {
    cancelTimers()
    hideTimer.current = setTimeout(() => setShowPreview(false), HIDE_GRACE_MS)
  }, [cancelTimers])

  const keepPreview = useCallback(() => cancelTimers(), [cancelTimers])
  const closePreview = useCallback(() => {
    cancelTimers()
    setShowPreview(false)
  }, [cancelTimers])

  // jupyter = always internal by slug (no jupyterUrl needed).
  // notion = needs linked Document (auto-created on article create).
  const articleUnlinked =
    node.nodeType === "article" &&
    !(
      node.articleType === "jupyter" ||
      (node.articleType === "notion" && node.notionPageId)
    )
  // notion-article-node Req 6.2: in the viewer an UNLINKED notion article is
  // visually disabled and inert (its click handler also bails).
  const viewerDisabled =
    viewerMode === true &&
    node.nodeType === "article" &&
    node.articleType === "notion" &&
    !node.notionPageId

  return (
    <>
      <div
        ref={cardRef}
        className={cn(
          "w-[238px] overflow-hidden rounded-[14px] border border-border bg-card text-card-foreground shadow-float transition-[border-color,transform,box-shadow] duration-200",
          selected && "border-2 border-primary",
          node.isDeleted && "cursor-not-allowed opacity-50 grayscale",
          viewerDisabled && "pointer-events-none cursor-not-allowed opacity-50"
        )}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onDoubleClick={data.onDoubleClick}
        title={
          node.isDeleted
            ? "Node đã bị xóa khỏi hệ thống"
            : viewerDisabled
              ? "Trang Notion chưa được tạo cho node này"
              : undefined
        }
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!size-2 !border-0 !bg-muted-foreground"
          isConnectable={!node.isDeleted}
        />
        <div className="p-4">
          <div className="flex min-h-6 items-center justify-between gap-2">
            {isOwner ? (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                Owner
              </span>
            ) : (
              <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted-foreground">
                {node.nodeType}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              {/* Filled = counts toward progress, hollow = optional. The canvas
                  legend names both, so the marker has to be on every card and
                  not only the optional ones — otherwise "bắt buộc" points at
                  nothing a reader can see. */}
              <span
                title={
                  isRequired ? "Bắt buộc — tính tiến độ" : "Tuỳ chọn"
                }
                aria-label={
                  isRequired ? "Bắt buộc — tính tiến độ" : "Tuỳ chọn"
                }
                className={cn(
                  "size-2.5 rounded-full",
                  isRequired
                    ? "bg-foreground"
                    : "border border-muted-foreground"
                )}
              />
              {node.isDeleted && (
                <AlertTriangle className="size-4 text-destructive" />
              )}
            </span>
          </div>
          <p className="mt-2 min-h-10 text-base leading-5 font-semibold">
            {node.title}
          </p>
          <div className="mt-3 aspect-[16/8] overflow-hidden rounded-lg border border-border bg-muted">
            {node.coverUrl ? (
              <img
                src={node.coverUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <div className="grid size-full place-items-center text-xs text-muted-foreground">
                <span className="flex flex-col items-center gap-1">
                  <ImageIcon className="size-5" />
                  Chưa có ảnh bìa
                </span>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="max-w-[116px] truncate">
              {node.authorName || node.authorId || "lh222k"}
            </span>
            <span>
              {node.level ? LEVEL_LABELS[node.level] : "Chưa xếp cấp"}
            </span>
          </div>
          {node.status === "in_progress" && (
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/5 rounded-full bg-foreground" />
            </div>
          )}
          {node.nodeType === "article" &&
            (articleUnlinked ? (
              <Badge
                variant="outline"
                className="mt-3 gap-1 border-amber-300 text-amber-700"
              >
                <AlertTriangle className="size-3" /> Chưa liên kết
              </Badge>
            ) : node.articleType === "notion" ? (
              <Badge variant="outline" className="mt-3 gap-1">
                <FileText className="size-3" /> Notion
              </Badge>
            ) : (
              <Badge variant="outline" className="mt-3 gap-1">
                <NotebookText className="size-3" /> Jupyter
              </Badge>
            ))}
        </div>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!size-2 !border-0 !bg-muted-foreground"
          isConnectable={!node.isDeleted}
        />
      </div>

      {/* Portal to body so no React Flow node can paint over the preview. */}
      {showPreview &&
        !node.isDeleted &&
        previewStyle &&
        typeof document !== "undefined" &&
        createPortal(
          <HoverPreview
            node={node}
            nodes={nodes}
            style={previewStyle}
            onMouseEnter={keepPreview}
            onMouseLeave={closePreview}
          />,
          document.body
        )}
    </>
  )
})
