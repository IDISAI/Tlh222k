"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { CheckCircle, Clock, Lock } from "lucide-react"

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
      <Handle type="source" position={Position.Bottom} className="!bg-zinc-400" />
    </div>
  )
})
