"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import type { RoadmapGraph, RoadmapNode } from "../types"
import { RoadmapService } from "../api"
import { NodeDetailDialog, ViewerCanvas } from "../builder"
import { subscribeRoadmapUpdates } from "../utils/update-signal"

const service = new RoadmapService()

export interface RoadmapViewerProps {
  slug: string
  /** Kept for call-site compatibility; the read-only viewer needs no role. */
  isAuthenticated?: boolean
  /** Server-rendered graph (web SSR). Omit to load fully client-side (admin). */
  initialGraph?: RoadmapGraph | null
  /** Renders a "back" button in the header (admin in-CMS viewer). */
  backHref?: string
  /** Show the "chỉ xem" preview badge (admin). */
  readOnlyBadge?: boolean
  /**
   * Where an internal jupyter article opens. Web (viewers) → "/learn"
   * (default, read-only viewer); admin/super-admin → "/notebooks" (editor).
   */
  notebookBasePath?: string
}

/**
 * The ONE roadmap viewer shared by web (:3000) and admin (:3002). It renders
 * the SAME canvas the admin builder uses (`ViewerCanvas` = colored nodes,
 * animated edges, minimap) but in read-only mode, so the viewer and the CMS can
 * never look or behave differently. Clicking any node opens the same right-side
 * detail sidebar (`NodeDetailDialog`) the builder shows — minus the edit/delete
 * actions. It pulls the graph from svc-roadmap on mount and re-pulls on every
 * builder save (SSE / BroadcastChannel), keeping every viewer in lockstep.
 */
export function RoadmapViewer({
  slug,
  initialGraph = null,
  backHref,
  readOnlyBadge = false,
  notebookBasePath = "/notebooks",
}: RoadmapViewerProps) {
  const [graph, setGraph] = useState<RoadmapGraph | null>(initialGraph)
  const [loading, setLoading] = useState(initialGraph === null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const refetch = useCallback(
    () => service.graphBySlug(slug, { authenticated: false }),
    [slug]
  )

  // Pull the freshest graph on mount (overlays any SSR snapshot / does the
  // initial client load for admin).
  useEffect(() => {
    let cancelled = false
    void refetch().then((fresh) => {
      if (cancelled) return
      setGraph(fresh)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [refetch])

  // Live sync: a builder save (any roadmap) re-pulls this viewer's graph.
  useEffect(() => {
    const unsubscribe = subscribeRoadmapUpdates(null, () => {
      void refetch().then((fresh) => {
        if (fresh) setGraph(fresh)
      })
    })
    return unsubscribe
  }, [refetch])

  const nodes = useMemo<RoadmapNode[]>(() => graph?.nodes ?? [], [graph])
  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null

  const handleNodeClick = useCallback((node: RoadmapNode) => {
    setSelectedId(node.id)
  }, [])

  return (
    <div className="flex h-[calc(100svh-57px)] flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        {backHref && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            nativeButton={false}
            render={<a href={backHref} />}
          >
            <ArrowLeft className="size-4" /> Quay lại
          </Button>
        )}
        <h1 className="min-w-0 truncate text-lg font-extrabold uppercase italic">
          {graph?.roadmap.title ?? (loading ? "Đang tải..." : "Roadmap")}
        </h1>
        {readOnlyBadge && (
          <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
            chỉ xem
          </span>
        )}
      </div>

      <div className="relative flex-1">
        {loading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-[50svh] w-full" />
          </div>
        ) : graph ? (
          <ViewerCanvas
            nodes={nodes}
            onNodeClick={handleNodeClick}
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">Không tìm thấy nội dung.</p>
          </div>
        )}
      </div>

      <NodeDetailDialog
        node={selectedNode}
        nodes={nodes}
        onClose={() => setSelectedId(null)}
        readOnly
        notebookBasePath={notebookBasePath}
      />
    </div>
  )
}
