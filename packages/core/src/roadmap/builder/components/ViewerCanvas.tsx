"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type ColorMode,
  type Edge,
  type Node,
} from "@xyflow/react"
import { useTheme } from "next-themes"

import "@xyflow/react/dist/style.css"

import type { NodeType, RoadmapNode } from "../../types"
import type { BuilderFlowNode, ChildCountEdge } from "../types"
import { deriveCompositionFromNodes } from "../../utils/derive-composition"
import { BuilderCanvasContext } from "./builder-context"
import { BuilderNodeComponent } from "./BuilderNodeComponent"
import { ChildCountEdgeComponent } from "./ChildCountEdge"

const nodeTypes = { builderNode: BuilderNodeComponent }
const edgeTypes = { childCount: ChildCountEdgeComponent }

/** Same colored, animated child-count edges the builder draws (Req 3.9). */
function buildViewerEdges(nodes: RoadmapNode[]): ChildCountEdge[] {
  const active = nodes.filter((n) => !n.isDeleted && n.nodeType !== "article")
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
  ownerId?: string | null
  onNodeClick?: (node: RoadmapNode) => void
  /** Double-click a node → open the right detail sidebar (matches the builder). */
  onNodeDoubleClick?: (node: RoadmapNode) => void
  className?: string
}

/**
 * Read-only twin of `BuilderCanvas`/`CompositionCanvas`: it renders the EXACT same
 * colored neo-brutalist nodes (`BuilderNodeComponent`), animated edges and minimap,
 * so the web viewer and the CMS canvas can't look different. If `ownerId` matches
 * a node, it renders only the composition (owner + members at their per-canvas coordinates).
 * Otherwise it falls back to rendering all nodes at their global coordinates.
 */
function ViewerCanvasInner({
  nodes,
  ownerId,
  onNodeClick,
  onNodeDoubleClick,
  className,
}: ViewerCanvasProps) {
  const { resolvedTheme } = useTheme()
  // Skip SSR entirely to avoid the ReactFlow colorMode hydration mismatch.
  // Server sends a plain div; client mounts the real canvas with the correct
  // colorMode from the start (no light→dark flip that breaks the MiniMap).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const colorMode: ColorMode = resolvedTheme === "dark" ? "dark" : "light"

  // Derive composition if ownerId is provided and exists in nodes
  const composition = useMemo(() => {
    if (!ownerId) return null
    const ownerExists = nodes.some((n) => n.id === ownerId)
    if (!ownerExists) return null
    return deriveCompositionFromNodes(ownerId, nodes)
  }, [ownerId, nodes])

  const rfNodes = useMemo<BuilderFlowNode[]>(() => {
    if (composition) {
      const owner = nodes.find((n) => n.id === ownerId)
      if (!owner) return []

      const next: BuilderFlowNode[] = []
      // 1. Add owner node at its global position
      next.push({
        id: owner.id,
        type: "builderNode" as const,
        position: { x: owner.positionX, y: owner.positionY },
        data: { node: owner, viewerMode: true },
        draggable: false,
        connectable: false,
      })
      // 2. Add member nodes at their composition positions
      const nodeById = new Map(nodes.map((n) => [n.id, n]))
      for (const m of composition.members) {
        const node = nodeById.get(m.nodeId)
        if (node && !node.isDeleted) {
          next.push({
            id: node.id,
            type: "builderNode" as const,
            position: { x: m.x, y: m.y },
            data: { node, viewerMode: true },
            draggable: false,
            connectable: false,
          })
        }
      }
      return next
    }

    // Fallback: render all nodes at their global positions
    return nodes
      .filter((n) => !n.isDeleted && n.nodeType !== "article")
      .map((n) => ({
        id: n.id,
        type: "builderNode" as const,
        position: { x: n.positionX, y: n.positionY },
        data: { node: n, viewerMode: true },
        draggable: false,
        connectable: false,
      }))
  }, [nodes, ownerId, composition])

  const rfEdges = useMemo<Edge[]>(() => {
    if (composition) {
      const nodeIds = new Set(rfNodes.map((n) => n.id))
      return composition.edges
        .filter((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId))
        .map((e) => ({
          id: e.id,
          source: e.sourceId,
          target: e.targetId,
          type: "default",
          animated: e.kind === "solid",
          style: e.kind === "dashed" ? { strokeDasharray: "6 4" } : undefined,
          data: { kind: e.kind },
        }))
    }
    return buildViewerEdges(nodes)
  }, [nodes, rfNodes, composition])

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
          onNodeClick={(_, rfNode) =>
            onNodeClick?.((rfNode.data as { node: RoadmapNode }).node)
          }
          onNodeDoubleClick={(_, rfNode) =>
            onNodeDoubleClick?.((rfNode.data as { node: RoadmapNode }).node)
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
