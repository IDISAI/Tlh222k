"use client"

import { useMemo } from "react"
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  type ColorMode,
  type Edge,
  type Node,
} from "@xyflow/react"
import { useTheme } from "next-themes"

import type { RoadmapNode } from "../../types"
import { childrenOf } from "./builder-context"

interface GraphPreviewProps {
  root: RoadmapNode
  nodes: RoadmapNode[]
}

const COL_W = 150
const ROW_H = 90

/**
 * Read-only 320×240 mini canvas inside the hover preview showing the node's
 * true direct children and grandchildren (Req 5.3/5.4). Uses a self-contained
 * tidy layout (parents centered above their children) instead of the raw
 * canvas coordinates, so it reads as a clear little tree rather than a
 * scattered, misleading copy of the big canvas.
 */
export function GraphPreview({ root, nodes }: GraphPreviewProps) {
  const { resolvedTheme } = useTheme()
  const colorMode: ColorMode = resolvedTheme === "dark" ? "dark" : "light"

  const { flowNodes, flowEdges } = useMemo(() => {
    const level1 = childrenOf(nodes, root.id)
    const pos = new Map<string, { x: number; y: number }>()
    const ordered: RoadmapNode[] = []

    let cursor = 0
    for (const parent of level1) {
      const kids = childrenOf(nodes, parent.id)
      if (kids.length === 0) {
        pos.set(parent.id, { x: cursor * COL_W, y: 0 })
        ordered.push(parent)
        cursor += 1
      } else {
        const start = cursor
        kids.forEach((kid, i) => {
          pos.set(kid.id, { x: (start + i) * COL_W, y: ROW_H })
          ordered.push(kid)
        })
        // Parent centered above its children.
        pos.set(parent.id, {
          x: (start + (kids.length - 1) / 2) * COL_W,
          y: 0,
        })
        ordered.push(parent)
        cursor += kids.length
      }
    }

    const nodesOut: Node[] = ordered.map((n) => ({
      id: n.id,
      position: pos.get(n.id) ?? { x: 0, y: 0 },
      data: { label: n.title },
      draggable: false,
      selectable: false,
      style: {
        fontSize: 10,
        padding: 4,
        width: 128,
        textAlign: "center" as const,
      },
    }))

    const ids = new Set(ordered.map((n) => n.id))
    const edgesOut: Edge[] = ordered
      .filter((n) => n.parentId && ids.has(n.parentId))
      .map((n) => ({
        id: `preview-${n.parentId}->${n.id}`,
        source: n.parentId as string,
        target: n.id,
      }))

    return { flowNodes: nodesOut, flowEdges: edgesOut }
  }, [root.id, nodes])

  return (
    // nodrag/nowheel: interactions inside the preview must not drag the host
    // node or zoom the outer canvas.
    <div className="nodrag nowheel h-[240px] w-[320px] overflow-hidden rounded-lg border bg-background">
      <ReactFlowProvider>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          colorMode={colorMode}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.2}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnScroll
          zoomOnScroll={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={12} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}
