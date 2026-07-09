"use client"

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react"

import type { ChildCountEdge } from "../types"

/**
 * Edge that badges the target node's direct-children count at its target end
 * (Req 3.9): a `skill` with 3 chapters shows "3" on every edge entering it.
 */
export function ChildCountEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<ChildCountEdge>) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const count = data?.count ?? 0

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={selected ? { strokeWidth: 2 } : undefined}
      />
      {count > 0 && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute z-10 flex size-5 items-center justify-center rounded-full border bg-background text-[10px] font-bold text-foreground shadow-sm"
            style={{
              transform: `translate(-50%, -50%) translate(${targetX}px, ${targetY - 22}px)`,
            }}
          >
            {count}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
