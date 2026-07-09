"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { AlertTriangle, CheckCircle, Clock, Lock } from "lucide-react"

import type { NodeStatus } from "../../types"
import type { RoadmapFlowNode } from "../types"
import { NODE_STATUS_COLORS } from "../utils/node-status-colors"

const STATUS_ICON: Record<NodeStatus, typeof Lock> = {
  locked: Lock,
  in_progress: Clock,
  done: CheckCircle,
}

/** Custom React Flow node — neo-brutalist card colored by status (Property 3). */
export const RoadmapNodeComponent = memo(function RoadmapNodeComponent({
  data,
}: NodeProps<RoadmapFlowNode>) {
  const { node } = data
  const Icon = STATUS_ICON[node.status]

  // Req 6.3/6.6: article nodes badge their document kind up front; unlinked
  // documents show a warning instead and never navigate.
  const isArticle = node.nodeType === "article"
  const articleLinked =
    (node.articleType === "notion" && node.notionPageId) ||
    (node.articleType === "jupyter" && node.jupyterUrl)

  return (
    <div
      className={
        "flex min-w-[168px] items-center gap-2 rounded-xl border-2 border-black px-4 py-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all dark:border-zinc-700 dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.15)] " +
        NODE_STATUS_COLORS[node.status]
      }
    >
      <Handle type="target" position={Position.Top} className="!bg-zinc-400" />
      <Icon className="size-4 shrink-0" />
      <span className="text-sm font-semibold">{node.title}</span>
      {isArticle &&
        (articleLinked ? (
          <span className="ml-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            {node.articleType}
          </span>
        ) : (
          <span title="Tài liệu chưa được liên kết">
            <AlertTriangle className="ml-1 size-3.5 shrink-0 text-amber-500" />
          </span>
        ))}
      <Handle type="source" position={Position.Bottom} className="!bg-zinc-400" />
    </div>
  )
})
