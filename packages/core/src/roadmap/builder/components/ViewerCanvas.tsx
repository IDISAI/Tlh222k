"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type ColorMode,
  type Edge,
  type Node,
} from "@xyflow/react"
import { useTheme } from "next-themes"
import { cn } from "@workspace/ui/lib/utils"

import "@xyflow/react/dist/style.css"

import type { CanvasViewport } from "../../../navigation/auth-return"
import type { Composition, NodeType, RoadmapNode } from "../../types"
import type { BuilderFlowNode, ChildCountEdge } from "../types"
import { deriveCompositionFromNodes } from "../../utils/derive-composition"
import { layoutForCanvas } from "../utils/spread-overlaps"
import { BuilderCanvasContext } from "./builder-context"
import { BuilderNodeComponent } from "./BuilderNodeComponent"
import { CanvasLegend } from "./CanvasLegend"
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
  /** Persisted composition wins over the legacy parentId-derived fallback. */
  composition?: Composition | null
  onNodeClick?: (node: RoadmapNode) => void
  /** Double-click a node → open the right detail sidebar (matches the builder). */
  onNodeDoubleClick?: (node: RoadmapNode) => void
  className?: string
  /**
   * Camera to open at, instead of framing the whole graph. Set when a URL
   * carries one, so a learner coming back from sign-in lands where they were
   * rather than zoomed back out to the top.
   */
  initialViewport?: CanvasViewport | null
  /** Fires as the learner pans or zooms, so the caller can persist the camera. */
  onViewportChange?: (viewport: CanvasViewport) => void
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
  composition: persistedComposition,
  onNodeClick,
  onNodeDoubleClick,
  className,
  initialViewport = null,
  onViewportChange,
}: ViewerCanvasProps) {
  const { resolvedTheme } = useTheme()
  // Skip SSR entirely to avoid the ReactFlow colorMode hydration mismatch.
  // Server sends a plain div; client mounts the real canvas with the correct
  // colorMode from the start (no light→dark flip that breaks the MiniMap).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const colorMode: ColorMode = resolvedTheme === "dark" ? "dark" : "light"
  const usesPersistedComposition =
    Boolean(ownerId) && persistedComposition?.ownerId === ownerId

  // Use persisted composition when present; derive only for legacy graphs.
  const composition = useMemo(() => {
    if (!ownerId) return null
    const ownerExists = nodes.some((n) => n.id === ownerId)
    if (!ownerExists) return null
    if (usesPersistedComposition) return persistedComposition
    return deriveCompositionFromNodes(ownerId, nodes)
  }, [ownerId, nodes, persistedComposition, usesPersistedComposition])

  const computedNodes = useMemo<BuilderFlowNode[]>(() => {
    // Stored coordinates cannot be rendered as-is. Blocks created from the CMS
    // table all arrived at (0, 0) — 27 of them in the database — and the ones
    // that were placed were placed when a card was a 168x40 pill rather than
    // today's 238x248 cover card. Either way cards land on top of each other,
    // and the top one swallows every click meant for the ones beneath it.
    // Render-time only: an admin dragging a card still saves where they drop it.
    const place = (raw: { id: string; x: number; y: number }[]) => {
      const laid = layoutForCanvas(raw)
      return new Map(laid.map((n) => [n.id, { x: n.x, y: n.y }]))
    }

    if (composition) {
      const owner = nodes.find((n) => n.id === ownerId)
      if (!owner) return []

      const nodeById = new Map(nodes.map((n) => [n.id, n]))
      const members = composition.members.filter((m) => {
        const node = nodeById.get(m.nodeId)
        return node && !node.isDeleted
      })
      const rawPositions = [
        { id: owner.id, x: owner.positionX, y: owner.positionY },
        ...members.map((m) => ({ id: m.nodeId, x: m.x, y: m.y })),
      ]
      // Composition coordinates are the editor's saved canvas layout. Reflowing
      // them in the viewer makes public and admin canvases disagree. Auto-layout
      // remains only for legacy graphs that have no persisted composition.
      const at = usesPersistedComposition
        ? new Map(
            rawPositions.map((node) => [node.id, { x: node.x, y: node.y }])
          )
        : place(rawPositions)

      const next: BuilderFlowNode[] = [
        {
          id: owner.id,
          type: "builderNode" as const,
          position: at.get(owner.id) ?? {
            x: owner.positionX,
            y: owner.positionY,
          },
          data: {
            node: owner,
            viewerMode: true,
            isOwner: true,
            onDoubleClick: () => onNodeDoubleClick?.(owner),
          },
          draggable: false,
          connectable: false,
        },
      ]
      for (const m of members) {
        const node = nodeById.get(m.nodeId)!
        next.push({
          id: node.id,
          type: "builderNode" as const,
          position: at.get(node.id) ?? { x: m.x, y: m.y },
          data: {
            node,
            viewerMode: true,
            isOwner: false,
            isRequired: m.isRequired !== false,
            onDoubleClick: () => onNodeDoubleClick?.(node),
          },
          draggable: false,
          connectable: false,
        })
      }
      return next
    }

    // Fallback: render all nodes at their global positions
    const visible = nodes.filter(
      (n) => !n.isDeleted && n.nodeType !== "article"
    )
    const at = place(
      visible.map((n) => ({ id: n.id, x: n.positionX, y: n.positionY }))
    )
    return visible.map((n) => ({
      id: n.id,
      type: "builderNode" as const,
      position: at.get(n.id) ?? { x: n.positionX, y: n.positionY },
      data: {
        node: n,
        viewerMode: true,
        isOwner: n.id === ownerId,
        onDoubleClick: () => onNodeDoubleClick?.(n),
      },
      draggable: false,
      connectable: false,
    }))
  }, [nodes, ownerId, composition, onNodeDoubleClick, usesPersistedComposition])

  const computedEdges = useMemo<Edge[]>(() => {
    if (composition) {
      const nodeIds = new Set(computedNodes.map((n) => n.id))
      return composition.edges
        .filter((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId))
        .map((e) => ({
          id: e.id,
          source: e.sourceId,
          target: e.targetId,
          type: "default",
          animated: false,
          style: e.kind === "dashed" ? { strokeDasharray: "6 4" } : undefined,
          data: { kind: e.kind },
        }))
    }
    return buildViewerEdges(nodes)
  }, [nodes, computedNodes, composition])

  // Feed the computed graph through useNodesState/useEdgesState (not a raw
  // `nodes` prop) so React Flow can apply its internal dimension measurements —
  // the MiniMap needs measured node sizes to draw its rects, and a controlled
  // `nodes` prop without `onNodesChange` never gets them (empty minimap).
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<BuilderFlowNode>(
    []
  )
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([])
  useEffect(() => setRfNodes(computedNodes), [computedNodes, setRfNodes])
  useEffect(() => setRfEdges(computedEdges), [computedEdges, setRfEdges])

  const contextValue = useMemo(
    () => ({ nodes, isDragging: false, composition }),
    [nodes, composition]
  )

  if (!mounted) return <div className={className ?? "h-full w-full"} />

  return (
    <BuilderCanvasContext.Provider value={contextValue}>
      <div className={cn("relative", className ?? "h-full w-full")}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          colorMode={colorMode}
          minZoom={0.25}
          maxZoom={2}
          // A restored camera wins over framing the graph — fitView would
          // immediately undo the position the learner is being returned to.
          fitView={!initialViewport}
          defaultViewport={initialViewport ?? undefined}
          zoomOnDoubleClick={false}
          nodesConnectable={false}
          nodesDraggable={false}
          // React Flow binds Delete/Backspace to "remove selection" by default.
          // Nothing here writes back, so it would not corrupt the roadmap — but
          // a reader who taps Backspace watches blocks vanish off a canvas they
          // were told is read-only, and only a reload brings them back.
          deleteKeyCode={null}
          elementsSelectable
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onMoveEnd={(_, viewport) => onViewportChange?.(viewport)}
          onNodeClick={(_, rfNode) =>
            onNodeClick?.((rfNode.data as { node: RoadmapNode }).node)
          }
          onNodeDoubleClick={(_, rfNode) =>
            onNodeDoubleClick?.((rfNode.data as { node: RoadmapNode }).node)
          }
        >
          <Background color="var(--border)" gap={20} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={minimapNodeColor}
            nodeStrokeWidth={2}
            className="!bg-background"
          />
        </ReactFlow>
        <CanvasLegend />
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
