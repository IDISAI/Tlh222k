"use client"

import { useCallback, useMemo, useState } from "react"
import {
  InteractiveRoadmap,
  NodeDrawer,
  ProgressService,
  type NodeStatus,
  type RoadmapGraph,
  type RoadmapNode,
} from "@workspace/core"

const progress = new ProgressService()

export function RoadmapDetailClient({
  graph,
  isAuthenticated,
}: {
  graph: RoadmapGraph
  isAuthenticated: boolean
}) {
  // Guests stay all-locked (Property 4); viewers overlay persisted progress.
  const [statuses, setStatuses] = useState<Record<string, NodeStatus>>(() =>
    isAuthenticated ? progress.getAll() : {}
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const nodes = useMemo<RoadmapNode[]>(
    () =>
      graph.nodes.map((n) => ({
        ...n,
        status: isAuthenticated ? (statuses[n.id] ?? "locked") : "locked",
      })),
    [graph.nodes, statuses, isAuthenticated]
  )

  const displayedGraph: RoadmapGraph = { roadmap: graph.roadmap, nodes }
  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null

  const handleStatusChange = useCallback(
    async (nodeId: string, next: NodeStatus) => {
      const previous = statuses[nodeId] ?? "locked"
      setStatuses((s) => ({ ...s, [nodeId]: next })) // optimistic <100ms
      try {
        await progress.set(nodeId, next)
      } catch {
        setStatuses((s) => ({ ...s, [nodeId]: previous })) // rollback
      }
    },
    [statuses]
  )

  return (
    <div className="flex h-[calc(100svh-57px)] flex-col">
      <div className="flex items-center justify-between border-b p-4">
        <h1 className="text-xl font-extrabold uppercase italic">
          {graph.roadmap.title}
        </h1>
      </div>
      <div className="relative flex-1">
        <InteractiveRoadmap
          graph={displayedGraph}
          onNodeClick={(node) => setSelectedId(node.id)}
          className="h-full w-full"
        />
      </div>
      <NodeDrawer
        node={selectedNode}
        isAuthenticated={isAuthenticated}
        onClose={() => setSelectedId(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  )
}
