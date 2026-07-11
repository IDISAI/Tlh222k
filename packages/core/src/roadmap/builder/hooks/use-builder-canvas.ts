"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "@workspace/ui/components/sonner"

import { RoadmapService } from "../../api"
import type {
  CallerRole,
  CreateNodeInput,
  Roadmap,
  RoadmapNode,
  UpdateNodeInput,
} from "../../types"
import { TOAST_MESSAGES, serviceErrorMessage } from "../utils/toast-messages"

/**
 * Domain state for one builder session. The canvas is the working copy:
 * `createNode` / `updateNodeMeta` / `deleteNodePermanent` hit the service
 * immediately, while membership, edges (parent links) and positions are
 * committed in one batch by `save()` (Req 3.10).
 */
export function useBuilderCanvas(
  roadmapId: string,
  role: CallerRole,
  /**
   * Node title ↔ Notion root-doc title are ONE title (QĐ-2). When an article
   * node backing a notion doc is renamed, this pushes the new title to the
   * matching Document (keyed by slug). Best-effort, cross-service; injected by
   * the admin page so `packages/core` never imports app Server Actions.
   */
  onTitleSync?: (slug: string, title: string) => void | Promise<void>
) {
  const service = useMemo(() => new RoadmapService(), [])

  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [nodes, setNodes] = useState<RoadmapNode[]>([])
  const [allNodes, setAllNodes] = useState<RoadmapNode[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Always-current snapshot of `nodes` for callbacks/history that must read the
  // latest without re-subscribing.
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes

  // Undo/redo history of canvas node snapshots (structural edits only).
  const [past, setPast] = useState<RoadmapNode[][]>([])
  const [future, setFuture] = useState<RoadmapNode[][]>([])

  /** Snapshot the current canvas before a structural change (cap 50 steps). */
  const pushHistory = useCallback(() => {
    setPast((p) => [...p.slice(-49), nodesRef.current])
    setFuture([])
  }, [])

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p
      const previous = p[p.length - 1] as RoadmapNode[]
      setFuture((f) => [nodesRef.current, ...f])
      setNodes(previous)
      setIsDirty(true)
      return p.slice(0, -1)
    })
  }, [])

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f
      const next = f[0] as RoadmapNode[]
      setPast((p) => [...p, nodesRef.current])
      setNodes(next)
      setIsDirty(true)
      return f.slice(1)
    })
  }, [])

  // All data is fetched client-side: the mock store persists to localStorage,
  // which the server render can never see (newly created roadmaps would 404).
  const load = useCallback(async () => {
    try {
      const [graph, all] = await Promise.all([
        service.graphById(roadmapId, { callerRole: role }),
        service.listNodes(),
      ])
      if (!graph) {
        setNotFound(true)
      } else {
        setRoadmap(graph.roadmap)
        setNodes(graph.nodes)
      }
      setAllNodes(all)
    } catch (error) {
      toast.error(serviceErrorMessage(error))
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [service, roadmapId, role])

  useEffect(() => {
    void load()
  }, [load])

  const refreshAllNodes = useCallback(async () => {
    setAllNodes(await service.listNodes())
  }, [service])

  /** Local position/metadata patch (no service call). */
  const applyNodePatch = useCallback(
    (id: string, patch: Partial<RoadmapNode>, opts: { dirty?: boolean } = {}) => {
      setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)))
      if (opts.dirty !== false) setIsDirty(true)
    },
    []
  )

  /** Re-link an edge locally: parent = null detaches (Req 3.8). */
  const reparent = useCallback(
    (childId: string, parentId: string | null) => {
      pushHistory()
      setNodes((prev) =>
        prev.map((n) => (n.id === childId ? { ...n, parentId } : n))
      )
      setIsDirty(true)
    },
    [pushHistory]
  )

  /**
   * Remove nodes from the canvas only — the system copy survives and shows up
   * again in the sidebar (Req 3.3 Delete / Req 4.5 "Xóa khỏi Canvas").
   */
  const removeFromCanvas = useCallback(
    (ids: string[]) => {
      pushHistory()
      const doomed = new Set(ids)
      setNodes((prev) =>
        prev
          .filter((n) => !doomed.has(n.id))
          .map((n) =>
            n.parentId && doomed.has(n.parentId) ? { ...n, parentId: null } : n
          )
      )
      setIsDirty(true)
    },
    [pushHistory]
  )

  /** Create in the system and place on the canvas selected (Req 3.1/3.2). */
  const createNode = useCallback(
    async (
      input: Omit<CreateNodeInput, "roadmapId">
    ): Promise<RoadmapNode | null> => {
      try {
        const node = await service.createNode(
          { ...input, roadmapId },
          role
        )
        pushHistory()
        setNodes((prev) => [...prev, node])
        setIsDirty(true)
        void refreshAllNodes()
        toast.success(TOAST_MESSAGES.CREATE_SUCCESS)
        return node
      } catch (error) {
        toast.error(serviceErrorMessage(error))
        return null
      }
    },
    [service, roadmapId, role, refreshAllNodes, pushHistory]
  )

  /**
   * Drop an existing sidebar node onto the canvas (Req 3.4).
   *
   * A node has a single `roadmapId`, so a node belonging to ANOTHER roadmap
   * can't merely be referenced here — dropping it CLONES it into this roadmap
   * (its source roadmap keeps the original). Without this, "saving" placed the
   * foreign node's position but never associated it, so the roadmap stayed
   * empty on the web viewer (the AI-Engineer "0 nodes" desync). Nodes that
   * already belong to this roadmap are just re-attached locally.
   */
  const addExistingToCanvas = useCallback(
    async (node: RoadmapNode, position: { x: number; y: number }) => {
      if (node.roadmapId !== roadmapId) {
        await createNode({
          nodeType: node.nodeType,
          title: node.title,
          description: node.description ?? undefined,
          articleType: node.articleType ?? undefined,
          notionPageId: node.notionPageId ?? undefined,
          jupyterUrl: node.jupyterUrl ?? undefined,
          parentId: null,
          positionX: position.x,
          positionY: position.y,
        })
        return
      }
      pushHistory()
      setNodes((prev) => [
        ...prev,
        {
          ...node,
          // Detach links that point outside this canvas.
          parentId: prev.some((n) => n.id === node.parentId)
            ? node.parentId
            : null,
          positionX: position.x,
          positionY: position.y,
        },
      ])
      setIsDirty(true)
    },
    [roadmapId, createNode, pushHistory]
  )

  /**
   * Metadata edit with optimistic apply + rollback on failure (Req 9.4/9.5).
   */
  const updateNodeMeta = useCallback(
    async (id: string, input: UpdateNodeInput): Promise<boolean> => {
      const previous = nodes.find((n) => n.id === id)
      if (!previous) return false
      applyNodePatch(
        id,
        {
          title: input.title ?? previous.title,
          description:
            input.description !== undefined
              ? input.description || null
              : previous.description,
          articleType:
            input.articleType !== undefined
              ? input.articleType
              : previous.articleType,
          notionPageId:
            input.notionPageId !== undefined
              ? input.notionPageId || null
              : previous.notionPageId,
          jupyterUrl:
            input.jupyterUrl !== undefined
              ? input.jupyterUrl || null
              : previous.jupyterUrl,
        },
        { dirty: false }
      )
      try {
        await service.updateNode(id, input, role)
        // Push a title rename to the linked notion doc (same slug). Only when
        // the title actually changed and the node has a slug to key on.
        if (
          input.title !== undefined &&
          input.title.trim() &&
          input.title.trim() !== previous.title &&
          previous.slug
        ) {
          void onTitleSync?.(previous.slug, input.title.trim())
        }
        void refreshAllNodes()
        toast.success(TOAST_MESSAGES.UPDATE_SUCCESS)
        return true
      } catch (error) {
        applyNodePatch(id, previous, { dirty: false }) // rollback
        toast.error(serviceErrorMessage(error))
        return false
      }
    },
    [nodes, applyNodePatch, service, role, refreshAllNodes, onTitleSync]
  )

  /**
   * Permanent system delete (Req 4.3). The node and its descendants become
   * Disabled_Node ghosts on the canvas unless `removeSelf` strips the root
   * (NodeDetailDialog's "Xóa" — Req 7.2).
   */
  const deleteNodePermanent = useCallback(
    async (id: string, opts: { removeSelf?: boolean } = {}): Promise<boolean> => {
      try {
        await service.deleteNode(id, role)
        // Cascade set computed over the whole system, not just this canvas.
        const doomed = new Set([id])
        let grew = true
        while (grew) {
          grew = false
          for (const n of allNodes) {
            if (n.parentId && doomed.has(n.parentId) && !doomed.has(n.id)) {
              doomed.add(n.id)
              grew = true
            }
          }
        }
        setNodes((prev) =>
          prev
            .filter((n) => !(opts.removeSelf && n.id === id))
            .map((n) => (doomed.has(n.id) ? { ...n, isDeleted: true } : n))
        )
        void refreshAllNodes()
        toast.success(TOAST_MESSAGES.DELETE_SUCCESS)
        return true
      } catch (error) {
        toast.error(serviceErrorMessage(error))
        return false
      }
    },
    [service, role, allNodes, refreshAllNodes]
  )

  /** Batch-save the whole canvas (Req 3.10/3.11). */
  const save = useCallback(async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      await service.saveRoadmap(roadmapId, nodes, role)
      setIsDirty(false)
      void refreshAllNodes()
      toast.success(TOAST_MESSAGES.SAVE_SUCCESS)
    } catch (error) {
      // Canvas state is intentionally left untouched (Req 3.11).
      toast.error(serviceErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }, [isSaving, service, roadmapId, nodes, role, refreshAllNodes])

  const deleteRoadmap = useCallback(async (): Promise<boolean> => {
    try {
      await service.deleteRoadmap(roadmapId, role)
      toast.success(TOAST_MESSAGES.DELETE_SUCCESS)
      return true
    } catch (error) {
      toast.error(serviceErrorMessage(error))
      return false
    }
  }, [service, roadmapId, role])

  const togglePublish = useCallback(async () => {
    if (!roadmap) return
    try {
      const updated = await service.updateRoadmap(
        roadmap.id,
        { isPublished: !roadmap.isPublished },
        role
      )
      setRoadmap(updated)
      toast.success(
        updated.isPublished ? "Đã xuất bản roadmap" : "Đã ngừng xuất bản roadmap"
      )
    } catch (error) {
      toast.error(serviceErrorMessage(error))
    }
  }, [service, roadmap, role])

  return {
    service,
    role,
    roadmap,
    nodes,
    nodesRef,
    allNodes,
    loading,
    notFound,
    isDirty,
    isSaving,
    applyNodePatch,
    reparent,
    addExistingToCanvas,
    removeFromCanvas,
    createNode,
    updateNodeMeta,
    deleteNodePermanent,
    save,
    deleteRoadmap,
    togglePublish,
    refreshAllNodes,
    // Undo/redo
    undo,
    redo,
    pushHistory,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  }
}

export type BuilderCanvasApi = ReturnType<typeof useBuilderCanvas>
