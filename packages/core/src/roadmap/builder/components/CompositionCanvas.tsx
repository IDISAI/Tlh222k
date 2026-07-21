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

import type { NodeType, RoadmapEdge, RoadmapNode } from "../../types"
import type { CompositionCanvasApi } from "../hooks/use-composition-canvas"
import type { BuilderFlowNode, CanvasMenuPosition } from "../types"
import { NODE_DND_MIME } from "../types"
import { TOAST_MESSAGES } from "../utils/toast-messages"
import { BlockContextMenu } from "./BlockContextMenu"
import { BuilderCanvasContext } from "./builder-context"
import { BuilderNodeComponent } from "./BuilderNodeComponent"
import { DeleteNodeDialog } from "./DeleteNodeDialog"
import { EdgeContextMenu } from "./EdgeContextMenu"
import { NodeDetailDialog } from "./NodeDetailDialog"
import { NodeEditPanel } from "./NodeEditPanel"
import { NodeSelectorModal } from "./NodeSelectorModal"

/** Only block types can be a roadmap on the canvas (no article blocks). */
const BLOCK_CREATE_TYPES: NodeType[] = ["role", "skill", "chapter"]

const nodeTypes = { builderNode: BuilderNodeComponent }

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
  return MINIMAP_COLORS[domain.nodeType] ?? "#94a3b8"
}

/** Composition edges → React Flow edges, styled by kind. */
function toFlowEdges(edges: RoadmapEdge[], nodeIds: Set<string>): Edge[] {
  return edges
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

interface CompositionCanvasProps {
  canvas: CompositionCanvasApi
  className?: string
  /** Base path for the detail-panel "Điều hướng" drill (admin builder root). */
  builderBasePath: string
  onSyncPublish?: (notionPageId: string, isPublished: boolean) => Promise<void>
}

function CompositionCanvasInner({
  canvas,
  className,
  builderBasePath,
  onSyncPublish,
}: CompositionCanvasProps) {
  const { resolvedTheme } = useTheme()
  const colorMode: ColorMode = resolvedTheme === "dark" ? "dark" : "light"
  const { screenToFlowPosition } = useReactFlow()

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<BuilderFlowNode>([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([])

  const [detailNode, setDetailNode] = useState<RoadmapNode | null>(null)
  const [editNode, setEditNode] = useState<RoadmapNode | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RoadmapNode | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [selector, setSelector] = useState<CanvasMenuPosition | null>(null)
  const [blockMenu, setBlockMenu] = useState<{
    node: RoadmapNode
    x: number
    y: number
  } | null>(null)
  const [edgeMenu, setEdgeMenu] = useState<{
    edge: RoadmapEdge
    x: number
    y: number
  } | null>(null)

  const ownerId = canvas.ownerNode?.id ?? ""

  // Domain → React Flow sync. The owner renders pinned at the top; members sit
  // at their stored canvas positions. Once a node is on the canvas React Flow
  // owns its live position (updated on drag) — only seed from domain coords
  // when a node first appears, so a re-sync never fights an in-flight drag.
  useEffect(() => {
    if (!canvas.ownerNode) return
    const owner = canvas.ownerNode
    setRfNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]))
      const next: BuilderFlowNode[] = []
      next.push({
        id: owner.id,
        type: "builderNode",
        position: prevById.get(owner.id)?.position ?? { x: owner.positionX, y: owner.positionY },
        data: { node: owner },
        draggable: true,
        selectable: true,
      })
      for (const m of canvas.memberNodes) {
        const existing = prevById.get(m.node.id)
        next.push({
          id: m.node.id,
          type: "builderNode",
          position: existing ? existing.position : { x: m.x, y: m.y },
          data: { node: m.node },
          draggable: true,
          selected: existing?.selected ?? false,
        })
      }
      return next
    })
    const ids = new Set<string>([owner.id, ...canvas.memberNodes.map((m) => m.node.id)])
    setRfEdges(toFlowEdges(canvas.edges, ids))
  }, [canvas.ownerNode, canvas.memberNodes, canvas.edges, setRfNodes, setRfEdges])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      if (connection.source === connection.target) return
      void canvas.addEdge(connection.source, connection.target, "solid")
    },
    [canvas]
  )

  const onNodeDragStart = useCallback(() => setIsDragging(true), [])

  const onNodeDragStop = useCallback(
    (_e: MouseEvent | TouchEvent, node: Node, dragged: Node[]) => {
      setIsDragging(false)
      const moved = dragged.length > 0 ? dragged : [node]
      for (const n of moved) {
        if (n.id === ownerId) {
          // Owner movement: update the owner node's position
          void canvas.updateNodeMeta(ownerId, {
            positionX: n.position.x,
            positionY: n.position.y,
          })
        } else {
          // Member movement: update composition member position
          canvas.moveMember(n.id, n.position)
        }
      }
    },
    [canvas, ownerId]
  )

  /** Cutting an edge on the canvas removes that link (other edges stay). */
  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      for (const edge of deleted) void canvas.removeEdge(edge.id)
    },
    [canvas]
  )

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, rfNode: Node) => {
      const domain =
        canvas.ownerNode?.id === rfNode.id
          ? canvas.ownerNode
          : canvas.memberNodes.find((m) => m.node.id === rfNode.id)?.node
      if (domain) setDetailNode(domain)
    },
    [canvas.ownerNode, canvas.memberNodes]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    if (event.dataTransfer.types.includes(NODE_DND_MIME)) {
      event.preventDefault()
      event.dataTransfer.dropEffect = "move"
    }
  }, [])

  /** Sidebar → canvas drop: add the dragged block as a member. */
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
      if (node.id === ownerId) {
        toast.info(TOAST_MESSAGES.NODE_ALREADY_ON_CANVAS)
        return
      }
      if (canvas.memberNodes.some((m) => m.node.id === node.id)) {
        toast.info(TOAST_MESSAGES.NODE_ALREADY_ON_CANVAS)
        return
      }
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      void canvas.addMember(node.id, position)
    },
    [canvas, ownerId, screenToFlowPosition]
  )

  /** Right-click empty canvas → create a new roadmap block here. */
  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault()
      const { clientX, clientY } = event
      const flow = screenToFlowPosition({ x: clientX, y: clientY })
      setBlockMenu(null)
      setEdgeMenu(null)
      setSelector({
        screenX: clientX,
        screenY: clientY,
        flowX: flow.x,
        flowY: flow.y,
      })
    },
    [screenToFlowPosition]
  )

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, rfNode: Node) => {
      event.preventDefault()
      const domain =
        canvas.ownerNode?.id === rfNode.id
          ? canvas.ownerNode
          : canvas.memberNodes.find((m) => m.node.id === rfNode.id)?.node
      if (!domain) return
      setSelector(null)
      setEdgeMenu(null)
      setBlockMenu({ node: domain, x: event.clientX, y: event.clientY })
    },
    [canvas.ownerNode, canvas.memberNodes]
  )

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, rfEdge: Edge) => {
      event.preventDefault()
      const edge = canvas.edges.find((e) => e.id === rfEdge.id)
      if (!edge) return
      setSelector(null)
      setBlockMenu(null)
      setEdgeMenu({ edge, x: event.clientX, y: event.clientY })
    },
    [canvas.edges]
  )

  const handleCreate = useCallback(
    async (input: { nodeType: NodeType; title: string; x: number; y: number }) => {
      const created = await canvas.createBlock({
        nodeType: input.nodeType,
        title: input.title,
        positionX: input.x,
        positionY: input.y,
      })
      return created !== null
    },
    [canvas]
  )

  const contextValue = useMemo(
    () => ({ nodes: canvas.allNodes, isDragging }),
    [canvas.allNodes, isDragging]
  )

  return (
    <BuilderCanvasContext.Provider value={contextValue}>
      <div className={className ?? "h-full w-full"}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
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
          onEdgesDelete={onEdgesDelete}
          onNodeDoubleClick={onNodeDoubleClick}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
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
        position={selector}
        parent={null}
        allowedTypes={BLOCK_CREATE_TYPES}
        onClose={() => setSelector(null)}
        onCreate={(input) =>
          handleCreate({
            nodeType: input.nodeType,
            title: input.title,
            x: input.x,
            y: input.y,
          })
        }
      />

      {blockMenu && (
        <BlockContextMenu
          node={blockMenu.node}
          isOwner={blockMenu.node.id === ownerId}
          screenX={blockMenu.x}
          screenY={blockMenu.y}
          onClose={() => setBlockMenu(null)}
          onEdit={setEditNode}
          onRemoveFromCanvas={(node) => void canvas.removeFromCanvas(node.id)}
          onDeletePermanent={setDeleteTarget}
        />
      )}

      {edgeMenu && (
        <EdgeContextMenu
          edge={edgeMenu.edge}
          screenX={edgeMenu.x}
          screenY={edgeMenu.y}
          onClose={() => setEdgeMenu(null)}
          onSetKind={(edgeId, kind) => void canvas.updateEdgeKind(edgeId, kind)}
          onRemove={(edgeId) => void canvas.removeEdge(edgeId)}
        />
      )}

      {deleteTarget && (
        <DeleteNodeDialog
          node={deleteTarget}
          childCount={0}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await canvas.deleteBlockPermanent(deleteTarget.id)
            setDeleteTarget(null)
          }}
        />
      )}

      <NodeDetailDialog
        node={detailNode}
        nodes={canvas.allNodes}
        onClose={() => setDetailNode(null)}
        onEdit={setEditNode}
        builderBasePath={builderBasePath}
        hideNavigate={detailNode?.id === ownerId}
        onCreateArticle={canvas.createArticle}
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
 * Editable ReactFlow canvas for ONE owner block's composition (LEGO model):
 * the owner pinned on top, member blocks at their positions, roadmap↔roadmap
 * edges. Drag from the sidebar to add a member; double-click opens the detail
 * panel (its "Điều hướng" drills into that block's own canvas).
 */
export function CompositionCanvas(props: CompositionCanvasProps) {
  return (
    <ReactFlowProvider>
      <CompositionCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
