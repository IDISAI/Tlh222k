"use client"

import type { CSSProperties } from "react"
import { AlertTriangle, CircleSlash, Link2 } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

import type { RoadmapNode } from "../../types"
import { truncateDescription } from "../../utils/truncate-description"
import { NODE_TYPE_ACCENT, NODE_TYPE_ICONS } from "../utils/node-type-styles"
import { childrenOf } from "./builder-context"
import { GraphPreview } from "./GraphPreview"

interface HoverPreviewProps {
  node: RoadmapNode
  nodes: RoadmapNode[]
  /** Fixed-position placement (portaled to body so nothing on the canvas clips it). */
  style?: CSSProperties
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  className?: string
}

/**
 * Tooltip card shown after 300ms of hovering a canvas node (Req 5): title,
 * type, ≤200-char description, direct-children count and — for role/skill
 * with children — an embedded GraphPreview. Rendered in a portal at a fixed
 * position so React Flow nodes never paint over it.
 */
export function HoverPreview({
  node,
  nodes,
  style,
  onMouseEnter,
  onMouseLeave,
  className,
}: HoverPreviewProps) {
  const Icon = NODE_TYPE_ICONS[node.nodeType]
  const children = childrenOf(nodes, node.id)
  const isBranch = node.nodeType === "role" || node.nodeType === "skill" || node.nodeType === "chapter"
  const isArticle = node.nodeType === "article"
  const articleLink =
    node.articleType === "notion" && node.notionPageId
      ? `https://notion.so/${node.notionPageId}`
      : node.articleType === "jupyter"
        ? `Internal notebook: /notebooks/${node.slug}`
        : null

  return (
    <div
      style={style}
      className={cn(
        "fixed z-9999 w-[360px] cursor-default rounded-xl border bg-popover p-4 text-left shadow-2xl",
        className
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Icon className={cn("size-4 shrink-0", NODE_TYPE_ACCENT[node.nodeType])} />
          <h4 className="min-w-0 truncate text-sm font-semibold">{node.title}</h4>
          <Badge variant="secondary">{node.nodeType}</Badge>
        </div>

        {node.description && (
          <p className="text-xs text-muted-foreground">
            {truncateDescription(node.description, 200)}
          </p>
        )}

        {isArticle ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {articleLink ? (
              <>
                <Badge variant="outline">{node.articleType}</Badge>
                <Link2 className="size-3 shrink-0" />
                <span className="truncate">{articleLink}</span>
              </>
            ) : (
              <>
                <AlertTriangle className="size-3 shrink-0 text-amber-500" />
                <span>Tài liệu chưa được liên kết</span>
              </>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Node con trực tiếp: {children.length}
          </p>
        )}

        {isBranch &&
          (children.length > 0 ? (
            <GraphPreview root={node} nodes={nodes} />
          ) : (
            <p className="flex items-center gap-1.5 text-sm italic text-muted-foreground">
              <CircleSlash className="size-3.5" /> Chưa có nội dung
            </p>
          ))}
      </div>
    </div>
  )
}
