"use client"

import { useMemo } from "react"
import {
  Background,
  Controls,
  ReactFlow,
  type ColorMode,
  type Edge,
} from "@xyflow/react"
import { useTheme } from "next-themes"

import "@xyflow/react/dist/style.css"

import type { RoadmapGraph, RoadmapNode } from "../../types"
import type { RoadmapFlowNode } from "../types"
import { buildEdges } from "../utils/build-edges"
import { RoadmapNodeComponent } from "./RoadmapNodeComponent"

const nodeTypes = { roadmapNode: RoadmapNodeComponent }

interface InteractiveRoadmapProps {
  graph: RoadmapGraph
  onNodeClick?: (node: RoadmapNode) => void
  className?: string
}

export function InteractiveRoadmap({
  graph,
  onNodeClick,
  className,
}: InteractiveRoadmapProps) {
  const { resolvedTheme } = useTheme()
  const colorMode: ColorMode = resolvedTheme === "dark" ? "dark" : "light"

  const nodes = useMemo<RoadmapFlowNode[]>(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: "roadmapNode",
        position: { x: n.positionX, y: n.positionY },
        data: { node: n },
      })),
    [graph.nodes]
  )

  const edges = useMemo<Edge[]>(() => buildEdges(graph.nodes), [graph.nodes])

  return (
    <div className={className ?? "h-full w-full"}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode={colorMode}
        minZoom={0.25} // Property 2 / R4: zoom clamped to [0.25, 2.0]
        maxZoom={2}
        fitView
        nodesDraggable={false}
        onNodeClick={(_, n) =>
          onNodeClick?.((n.data as { node: RoadmapNode }).node)
        }
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
