"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
  // Start empty so the first client render matches the server's all-locked HTML
  // (localStorage is client-only; reading it during the initial render would
  // diverge and break hydration — Lock vs Clock icon mismatch).
  const [statuses, setStatuses] = useState<Record<string, NodeStatus>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Overlay persisted progress after mount (Property 4: guests stay all-locked).
  useEffect(() => {
    if (isAuthenticated) setStatuses(progress.getAll())
  }, [isAuthenticated])

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
