"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type ColorMode,
  type Node,
} from "@xyflow/react"
import { useTheme } from "next-themes"

import "@xyflow/react/dist/style.css"

import type { NodeType, RoadmapNode } from "../../types"
import type { BuilderFlowNode, ChildCountEdge } from "../types"
import { BuilderCanvasContext } from "./builder-context"
import { BuilderNodeComponent } from "./BuilderNodeComponent"
import { ChildCountEdgeComponent } from "./ChildCountEdge"

const nodeTypes = { builderNode: BuilderNodeComponent }
const edgeTypes = { childCount: ChildCountEdgeComponent }

/** Same colored, animated child-count edges the builder draws (Req 3.9). */
function buildViewerEdges(nodes: RoadmapNode[]): ChildCountEdge[] {
  const active = nodes.filter((n) => !n.isDeleted)
  const ids = new Set(active.map((n) => n.id))
  const counts = new Map<string, number>()
  for (const n of active) {
    if (n.parentId) counts.set(n.parentId, (counts.get(n.parentId) ?? 0) + 1)
  }
  return active
    .filter((n) => n.parentId !== null && ids.has(n.parentId))
    .map((n) => ({
      id: `${n.parentId}->${n.id}`,
      source: n.parentId as string,
      target: n.id,
      type: "childCount" as const,
      animated: true,
      data: { count: counts.get(n.id) ?? 0 },
    }))
}

const MINIMAP_COLORS: Record<NodeType, string> = {
  role: "#3b82f6",
  skill: "#a855f7",
  chapter: "#f97316",
  article: "#10b981",
}

function minimapNodeColor(node: Node): string {
  const domain = (node.data as { node?: RoadmapNode })?.node
  if (!domain) return "#94a3b8"
  if (domain.isDeleted) return "#cbd5e1"
  return MINIMAP_COLORS[domain.nodeType] ?? "#94a3b8"
}

interface ViewerCanvasProps {
  nodes: RoadmapNode[]
  onNodeClick?: (node: RoadmapNode) => void
  className?: string
}

/**
 * Read-only twin of `BuilderCanvas`: it renders the EXACT same colored
 * neo-brutalist nodes (`BuilderNodeComponent`), animated child-count edges and
 * minimap the admin builder uses, so the web viewer and the CMS canvas can't
 * look different. All editing is stripped — no drag, connect, context menu or
 * drop — leaving just pan/zoom + a click that opens the node detail sidebar.
 */
function ViewerCanvasInner({ nodes, onNodeClick, className }: ViewerCanvasProps) {
  const { resolvedTheme } = useTheme()
  // Skip SSR entirely to avoid the ReactFlow colorMode hydration mismatch.
  // Server sends a plain div; client mounts the real canvas with the correct
  // colorMode from the start (no light→dark flip that breaks the MiniMap).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const colorMode: ColorMode = resolvedTheme === "dark" ? "dark" : "light"

  const rfNodes = useMemo<BuilderFlowNode[]>(
    () =>
      nodes
        .filter((n) => !n.isDeleted)
        .map((n) => ({
          id: n.id,
          type: "builderNode" as const,
          position: { x: n.positionX, y: n.positionY },
          data: { node: n },
          draggable: false,
          connectable: false,
        })),
    [nodes]
  )

  const rfEdges = useMemo(() => buildViewerEdges(nodes), [nodes])
  const contextValue = useMemo(() => ({ nodes, isDragging: false }), [nodes])

  if (!mounted) return <div className={className ?? "h-full w-full"} />

  return (
    <BuilderCanvasContext.Provider value={contextValue}>
      <div className={className ?? "h-full w-full"}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          colorMode={colorMode}
          minZoom={0.25}
          maxZoom={2}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          onNodeDoubleClick={(_, rfNode) =>
            onNodeClick?.((rfNode.data as { node: RoadmapNode }).node)
          }
        >
          <Background />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={minimapNodeColor}
            nodeStrokeWidth={2}
            className="!bg-background"
          />
        </ReactFlow>
      </div>
    </BuilderCanvasContext.Provider>
  )
}

export function ViewerCanvas(props: ViewerCanvasProps) {
  return (
    <ReactFlowProvider>
      <ViewerCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
