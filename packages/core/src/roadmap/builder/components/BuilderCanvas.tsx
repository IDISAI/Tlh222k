"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type ColorMode,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react"
import { useTheme } from "next-themes"

import "@xyflow/react/dist/style.css"

import { toast } from "@workspace/ui/components/sonner"

import { type ArticleType, type NodeType, type RoadmapNode } from "../../types"
import type { BuilderCanvasApi } from "../hooks/use-builder-canvas"
import type {
  BuilderFlowNode,
  CanvasMenuPosition,
  ChildCountEdge,
} from "../types"
import { NODE_DND_MIME } from "../types"
import { TOAST_MESSAGES } from "../utils/toast-messages"
import { BuilderCanvasContext } from "./builder-context"
import { BuilderNodeComponent } from "./BuilderNodeComponent"
import { ChildCountEdgeComponent } from "./ChildCountEdge"
import { NodeContextMenu } from "./NodeContextMenu"
import { NodeDetailDialog } from "./NodeDetailDialog"
import { NodeEditPanel } from "./NodeEditPanel"
import { NodeSelectorModal } from "./NodeSelectorModal"

const nodeTypes = { builderNode: BuilderNodeComponent }
const edgeTypes = { childCount: ChildCountEdgeComponent }

interface BuilderCanvasProps {
  canvas: BuilderCanvasApi
  className?: string
  /** Publish-state sync for notion articles (notion-article-node Req 7). */
  onSyncPublish?: (notionPageId: string, isPublished: boolean) => Promise<void>
}

/** Derive edges (+ child-count badges, Req 3.9) from parent links. */
function buildBuilderEdges(nodes: RoadmapNode[]): ChildCountEdge[] {
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
      animated: true, // flowing edge animation
      // Badge shows the TARGET node's direct-children count (Req 3.9).
      data: { count: counts.get(n.id) ?? 0 },
    }))
}

/** Solid hex per NodeType for the minimap dots (tailwind-500 equivalents). */
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

function BuilderCanvasInner({
  canvas,
  className,
  onSyncPublish,
}: BuilderCanvasProps) {
  const { resolvedTheme } = useTheme()
  const colorMode: ColorMode = resolvedTheme === "dark" ? "dark" : "light"
  const { screenToFlowPosition, setCenter } = useReactFlow()

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<BuilderFlowNode>([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<ChildCountEdge>([])
  const initializedRef = useRef(false)

  const [selector, setSelector] = useState<{
    position: CanvasMenuPosition
    parent: RoadmapNode | null
  } | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{
    node: RoadmapNode
    x: number
    y: number
  } | null>(null)
  const [detailNode, setDetailNode] = useState<RoadmapNode | null>(null)
  const [editNode, setEditNode] = useState<RoadmapNode | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Domain → React Flow sync. Previous selection is preserved; nodes that are
  // new to the canvas come in selected with handles ready (Req 3.1/3.4).
  useEffect(() => {
    setRfNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]))
      const next = canvas.nodes.map<BuilderFlowNode>((dn) => {
        const existing = prevById.get(dn.id)
        return {
          id: dn.id,
          type: "builderNode" as const,
          // Once a node is on the canvas, React Flow owns its live position
          // (updated via onNodesChange during drag); only seed from domain
          // coords when the node first appears. Reseeding every sync would
          // fight the drag and make nodes feel unmovable.
          position: existing ? existing.position : { x: dn.positionX, y: dn.positionY },
          data: { node: dn },
          draggable: !dn.isDeleted,
          connectable: !dn.isDeleted,
          selected: existing ? existing.selected : initializedRef.current,
        }
      })
      initializedRef.current = true
      return next
    })
    setRfEdges(buildBuilderEdges(canvas.nodes))
  }, [canvas.nodes, setRfNodes, setRfEdges])

  // Undo (Ctrl/Cmd+Z) / Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y). Ignored while typing
  // in a form field so native input undo still works.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return
      }
      const key = e.key.toLowerCase()
      if (key === "z" && !e.shiftKey) {
        e.preventDefault()
        canvas.undo()
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault()
        canvas.redo()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [canvas])

  // ── Interactions ──────────────────────────────────────────────────────────

  /**
   * Edge draw — any node may link to any node now (the hierarchy rule and the
   * children cap were removed on request). We only refuse links to/from a node
   * that was deleted from the system.
   */
  const onConnect = useCallback(
    (connection: Connection) => {
      const nodes = canvas.nodesRef.current
      const source = nodes.find((n) => n.id === connection.source)
      const target = nodes.find((n) => n.id === connection.target)
      if (!source || !target) return
      if (source.isDeleted || target.isDeleted) {
        toast.warning(TOAST_MESSAGES.NODE_DELETED_FROM_SYSTEM)
        return
      }
      canvas.reparent(target.id, source.id)
    },
    [canvas]
  )

  const onNodeDragStart = useCallback(() => {
    setIsDragging(true)
    canvas.pushHistory() // snapshot pre-drag positions for undo
  }, [canvas])

  /** Commit dragged positions back to the domain copy. */
  const onNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: Node, draggedNodes: Node[]) => {
      setIsDragging(false)
      const moved = draggedNodes.length > 0 ? draggedNodes : [node]
      for (const n of moved) {
        canvas.applyNodePatch(n.id, {
          positionX: n.position.x,
          positionY: n.position.y,
        })
      }
    },
    [canvas]
  )

  /** Delete key / RF removal → canvas-only removal (Req 3.3). */
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      canvas.removeFromCanvas(deleted.map((n) => n.id))
    },
    [canvas]
  )

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      for (const edge of deleted) canvas.reparent(edge.target, null)
    },
    [canvas]
  )

  /** Right-click on empty canvas → NodeSelector_Modal at the cursor (Req 3.1). */
  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault()
      const { clientX, clientY } = event
      const flow = screenToFlowPosition({ x: clientX, y: clientY })
      setCtxMenu(null)
      setSelector({
        position: {
          screenX: clientX,
          screenY: clientY,
          flowX: flow.x,
          flowY: flow.y,
        },
        parent: null,
      })
    },
    [screenToFlowPosition]
  )

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, rfNode: Node) => {
      event.preventDefault()
      const domain = canvas.nodesRef.current.find((n) => n.id === rfNode.id)
      if (!domain) return
      setSelector(null)
      setCtxMenu({ node: domain, x: event.clientX, y: event.clientY })
    },
    [canvas]
  )

  /**
   * Double-click opens NodeDetail_Dialog (Req 7.1); ghosts stay inert.
   * Article notion nodes with a linked Document ALSO auto-navigate to the
   * notion workspace (notion-article-node Req 1.2) — the sidebar renders
   * first as visual feedback, then the page navigates after a short delay.
   */
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, rfNode: Node) => {
      const domain = canvas.nodesRef.current.find((n) => n.id === rfNode.id)
      if (!domain || domain.isDeleted) return
      setDetailNode(domain)
      if (
        domain.nodeType === "article" &&
        domain.articleType === "notion" &&
        domain.notionPageId
      ) {
        const parent = canvas.nodesRef.current.find(
          (n) => n.id === domain.parentId
        )
        const chapterSlug =
          parent?.nodeType === "chapter" ? parent.slug : undefined
        if (chapterSlug) {
          setTimeout(() => {
            window.location.assign(
              `/notion/${chapterSlug}?page=${encodeURIComponent(domain.slug)}`
            )
          }, 100)
        }
      }
    },
    [canvas]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    if (event.dataTransfer.types.includes(NODE_DND_MIME)) {
      event.preventDefault()
      event.dataTransfer.dropEffect = "move"
    }
  }, [])

  /** Sidebar → canvas drop (Req 3.4/3.7/4.6). */
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      const raw = event.dataTransfer.getData(NODE_DND_MIME)
      if (!raw) return
      event.preventDefault()
      let node: RoadmapNode
      try {
        node = JSON.parse(raw) as RoadmapNode
      } catch {
        return
      }
      if (node.isDeleted) {
        toast.warning(TOAST_MESSAGES.NODE_DELETED_FROM_SYSTEM)
        return
      }
      const existing = canvas.nodesRef.current.find((n) => n.id === node.id)
      if (existing) {
        // Req 3.7: no duplicate — scroll to and highlight the original.
        setCenter(existing.positionX + 84, existing.positionY + 20, {
          zoom: 1.2,
          duration: 500,
        })
        setRfNodes((prev) =>
          prev.map((n) => ({ ...n, selected: n.id === node.id }))
        )
        toast.info(TOAST_MESSAGES.NODE_ALREADY_ON_CANVAS)
        return
      }
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      void canvas.addExistingToCanvas(node, position)
    },
    [canvas, screenToFlowPosition, setCenter, setRfNodes]
  )

  /** "Thêm node con" — selector constrained to level + 1 (Req 2.3). */
  const handleAddChild = useCallback(
    (parent: RoadmapNode) => {
      setSelector({
        position: {
          screenX: ctxMenu?.x ?? window.innerWidth / 2,
          screenY: ctxMenu?.y ?? window.innerHeight / 3,
          flowX: parent.positionX + 48,
          flowY: parent.positionY + 160,
        },
        parent,
      })
    },
    [ctxMenu]
  )

  const handleCreate = useCallback(
    async (input: {
      nodeType: NodeType
      articleType?: ArticleType
      title: string
      parentId: string | null
      x: number
      y: number
    }) => {
      const created = await canvas.createNode({
        nodeType: input.nodeType,
        articleType: input.articleType,
        title: input.title,
        parentId: input.parentId,
        positionX: input.x,
        positionY: input.y,
      })
      return created !== null
    },
    [canvas]
  )

  const contextValue = useMemo(
    () => ({ nodes: canvas.nodes, isDragging }),
    [canvas.nodes, isDragging]
  )

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
          nodesDraggable
          deleteKeyCode={["Delete", "Backspace"]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          onNodeDoubleClick={onNodeDoubleClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <Background />
          <Controls />
          <MiniMap
            pannable
            zoomable
            nodeColor={minimapNodeColor}
            nodeStrokeWidth={2}
            className="!bg-background"
          />
        </ReactFlow>
      </div>

      <NodeSelectorModal
        position={selector?.position ?? null}
        parent={selector?.parent ?? null}
        onClose={() => setSelector(null)}
        onCreate={handleCreate}
      />

      {ctxMenu && (
        <NodeContextMenu
          node={ctxMenu.node}
          screenX={ctxMenu.x}
          screenY={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onEdit={setEditNode}
          onAddChild={handleAddChild}
          onRemoveFromCanvas={(node) => canvas.removeFromCanvas([node.id])}
        />
      )}

      <NodeDetailDialog
        node={detailNode}
        nodes={canvas.nodes}
        onClose={() => setDetailNode(null)}
        onEdit={setEditNode}
        onRemoveFromCanvas={(node) => canvas.removeFromCanvas([node.id])}
        builderBasePath="/roadmaps"
      />

      {editNode && (
        <NodeEditPanel
          node={editNode}
          onClose={() => setEditNode(null)}
          onSave={canvas.updateNodeMeta}
          onSyncPublish={onSyncPublish}
        />
      )}
    </BuilderCanvasContext.Provider>
  )
}

/**
 * Editable ReactFlow canvas (Req 3): right-click create, drag-drop from the
 * sidebar, hierarchy-validated edges with child-count badges, hover previews
 * and the NodeDetail dialog — wrapped in its own ReactFlowProvider.
 */
export function BuilderCanvas(props: BuilderCanvasProps) {
  return (
    <ReactFlowProvider>
      <BuilderCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
