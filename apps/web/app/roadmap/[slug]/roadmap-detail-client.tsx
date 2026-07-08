"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  InteractiveRoadmap,
  NodeDrawer,
  ProgressService,
  RoadmapService,
  UpdateBanner,
  type NodeStatus,
  type RoadmapGraph,
  type RoadmapNode,
} from "@workspace/core"

const progress = new ProgressService()
const service = new RoadmapService()

export function RoadmapDetailClient({
  graph: initialGraph,
  isAuthenticated,
}: {
  graph: RoadmapGraph
  isAuthenticated: boolean
}) {
  const router = useRouter()

  // Start empty so the first client render matches the server's all-locked HTML
  // (localStorage is client-only; reading it during the initial render would
  // diverge and break hydration — Lock vs Clock icon mismatch).
  const [statuses, setStatuses] = useState<Record<string, NodeStatus>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // The server rendered from the pristine seed; the client store overlays
  // builder edits persisted to localStorage (same origin as the admin zone).
  // Re-fetching post-mount keeps hydration clean and shows the latest save.
  // ponytail: disappears once the server reads from svc-roadmap.
  const [graph, setGraph] = useState(initialGraph)
  useEffect(() => {
    let cancelled = false
    void service
      .graphBySlug(initialGraph.roadmap.slug, { authenticated: false })
      .then((fresh) => {
        if (fresh && !cancelled) setGraph(fresh)
      })
    return () => {
      cancelled = true
    }
  }, [initialGraph.roadmap.slug])

  // Overlay persisted progress after mount (Property 4: guests stay all-locked).
  // Statuses are keyed by nodeId, so they survive reloads (Req 8.6).
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

  // Req 6: role/skill navigate to their inner structure; linked articles open
  // their document in a new tab; unlinked articles show ⚠️ and do nothing;
  // chapters keep the in-app content drawer (progress tracking).
  const handleNodeClick = useCallback(
    (node: RoadmapNode) => {
      if (node.nodeType === "role" || node.nodeType === "skill") {
        router.push(`/roadmap/${node.slug}`)
        return
      }
      if (node.nodeType === "article") {
        if (node.articleType === "notion" && node.notionPageId) {
          window.open(
            `https://notion.so/${node.notionPageId}`,
            "_blank",
            "noopener,noreferrer"
          )
        } else if (node.articleType === "jupyter" && node.jupyterUrl) {
          window.open(node.jupyterUrl, "_blank", "noopener,noreferrer")
        }
        // Unlinked documents: no navigation (Req 6.6).
        return
      }
      setSelectedId(node.id)
    },
    [router]
  )

  return (
    <div className="flex h-[calc(100svh-57px)] flex-col">
      {/* Req 8: reload prompt when the builder publishes new data. */}
      <UpdateBanner />
      <div className="flex items-center justify-between border-b p-4">
        <h1 className="text-xl font-extrabold uppercase italic">
          {graph.roadmap.title}
        </h1>
      </div>
      <div className="relative flex-1">
        <InteractiveRoadmap
          graph={displayedGraph}
          onNodeClick={handleNodeClick}
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
