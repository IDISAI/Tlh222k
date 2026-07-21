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
import { AlertTriangle, FileText, NotebookText } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

import type { BuilderFlowNode } from "../types"
import { NODE_TYPE_COLORS, NODE_TYPE_ICONS } from "../utils/node-type-styles"
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
  const { node, viewerMode } = data
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

  const Icon = NODE_TYPE_ICONS[node.nodeType]
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
          "flex min-w-[168px] items-center gap-2 rounded-xl border-2 px-4 py-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.15)]",
          NODE_TYPE_COLORS[node.nodeType],
          selected && "ring-2 ring-ring ring-offset-2",
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
          className="!bg-zinc-400"
          isConnectable={!node.isDeleted}
        />
        {node.isDeleted && (
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
        )}
        <Icon className="size-4 shrink-0" />
        <span className="text-sm font-semibold">{node.title}</span>
        {node.nodeType === "article" &&
          (articleUnlinked ? (
            // Req 6.6: unlinked articles warn instead of navigating.
            <span title="Tài liệu chưa được liên kết">
              <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
            </span>
          ) : node.articleType === "notion" ? (
            <Badge className="ml-1 gap-1 border-transparent bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
              <FileText className="size-3" /> Notion
            </Badge>
          ) : (
            <Badge className="ml-1 gap-1 border-transparent bg-orange-500 text-white">
              <NotebookText className="size-3" /> Jupyter
            </Badge>
          ))}
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-zinc-400"
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
