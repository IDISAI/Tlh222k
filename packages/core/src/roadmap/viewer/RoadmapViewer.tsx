"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { ArrowLeft, Search } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

import type { NodeType, RoadmapGraph, RoadmapNode } from "../types"
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
  /**
   * Where an internal notion article opens. Web (viewers) → "/notion"
   * (default, read-only workspace); admin → its own "/notion" editor zone.
   */
  notionBasePath?: string
  /** Web injects its auth control; admin already owns auth in the outer shell. */
  headerActions?: ReactNode
  /** Admin/super-admin render inside a 64px shell header. */
  embedded?: boolean
  homeHref?: string
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
  notionBasePath = "/notion",
  headerActions,
  embedded = false,
  homeHref = "/",
}: RoadmapViewerProps) {
  const [graph, setGraph] = useState<RoadmapGraph | null>(initialGraph)
  const [loading, setLoading] = useState(initialGraph === null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [nodeType, setNodeType] = useState<"all" | NodeType>("all")
  const [author, setAuthor] = useState("all")

  // LEGO per-block viewer: `slug` is the block NODE id from the home card.
  // Resolve its single-level composition; fall back to the legacy slug graph.
  const refetch = useCallback(
    async () =>
      (await service.publicBlockGraph(slug)) ??
      (await service.graphBySlug(slug, { authenticated: false })),
    [slug]
  )

  // Pull the freshest graph on mount and on bfcache-restore.
  useEffect(() => {
    let cancelled = false
    const load = () => {
      refetch().then((fresh) => {
        if (cancelled) return
        setGraph(fresh)
        setLoading(false)
      })
    }
    load()

    const handleRestore = () => {
      load()
    }
    window.addEventListener("bfcache-restore", handleRestore)
    return () => {
      cancelled = true
      window.removeEventListener("bfcache-restore", handleRestore)
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
  const ownerId = graph?.roadmap.id
  const authorOptions = useMemo(
    () =>
      Array.from(
        new Set(
          nodes
            .map((node) => node.authorName || node.authorId)
            .filter((value): value is string => Boolean(value))
        )
      ),
    [nodes]
  )
  const visibleNodes = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("vi")
    return nodes.filter((node) => {
      if (node.id === ownerId) return true
      if (needle && !node.title.toLocaleLowerCase("vi").includes(needle))
        return false
      if (nodeType !== "all" && node.nodeType !== nodeType) return false
      if (
        author !== "all" &&
        (node.authorName || node.authorId || "") !== author
      )
        return false
      return true
    })
  }, [author, nodeType, nodes, ownerId, query])

  // Double-click any node → open the right detail sidebar, exactly like the
  // admin builder (CompositionCanvas `onNodeDoubleClick`). Drilling into a
  // member block now happens from that sidebar's "Điều hướng" button, so the
  // viewer and the CMS share one interaction model.
  const handleNodeOpen = useCallback((node: RoadmapNode) => {
    setSelectedId(node.id)
  }, [])

  return (
    <div
      className={cn(
        "flex flex-col bg-background",
        embedded ? "h-[calc(100svh-64px)]" : "h-svh"
      )}
    >
      <header className="grid min-h-[76px] grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-border px-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <a
            href={homeHref}
            className="shrink-0 text-[22px] font-bold tracking-[-.5px]"
          >
            lh222k
          </a>
          {backHref && (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              nativeButton={false}
              render={<a href={backHref} aria-label="Quay lại" />}
            >
              <ArrowLeft className="size-4" />
            </Button>
          )}
          {readOnlyBadge && (
            <span className="hidden rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground sm:inline-flex">
              Chỉ xem
            </span>
          )}
        </div>

        <div className="hidden h-12 items-center overflow-hidden rounded-full border border-border bg-background shadow-float md:flex">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm một node"
            aria-label="Tìm một node"
            className="h-full w-36 bg-transparent px-4 text-sm outline-none lg:w-48"
          />
          <span className="h-6 w-px bg-border" />
          <select
            value={nodeType}
            onChange={(event) =>
              setNodeType(event.target.value as "all" | NodeType)
            }
            aria-label="Lọc theo loại node"
            className="h-full bg-transparent px-3 text-sm font-medium outline-none"
          >
            <option value="all">Loại</option>
            <option value="role">Role</option>
            <option value="skill">Skill</option>
            <option value="chapter">Chapter</option>
          </select>
          <span className="h-6 w-px bg-border" />
          <select
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            aria-label="Lọc theo tác giả"
            className="h-full bg-transparent px-3 text-sm font-medium outline-none"
          >
            <option value="all">Tác giả</option>
            {authorOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <span className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
            <Search className="size-4" />
          </span>
        </div>

        <div className="flex items-center justify-end">{headerActions}</div>
      </header>

      <div className="relative flex-1">
        {loading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-[50svh] w-full" />
          </div>
        ) : graph ? (
          <ViewerCanvas
            nodes={visibleNodes}
            ownerId={ownerId}
            onNodeClick={handleNodeOpen}
            onNodeDoubleClick={handleNodeOpen}
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
        hideNavigate={selectedNode?.id === ownerId}
        notebookBasePath={notebookBasePath}
        notionBasePath={notionBasePath}
      />
    </div>
  )
}
