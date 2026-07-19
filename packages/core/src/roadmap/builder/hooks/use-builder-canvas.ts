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
  onTitleSync?: (slug: string, title: string) => void | Promise<void>,
  /**
   * Post-create hook (notion-article-node Req 2): creating an article node
   * with articleType "notion" auto-creates the matching Document (same slug),
   * parented under the chapter's root doc when the parent chapter is known.
   * Injected by the admin page.
   */
  onCreateNotionDoc?: (
    slug: string,
    title: string,
    parentChapterSlug?: string
  ) => Promise<{ id: string } | null>
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
    console.log("[builder-diag] mount effect fired")
    void load()

    const handleRestore = () => {
      void load()
    }
    window.addEventListener("bfcache-restore", handleRestore)
    return () => {
      window.removeEventListener("bfcache-restore", handleRestore)
    }
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
   * Create in the system and place on the canvas selected (Req 3.1/3.2).
   *
   * Post-create side effects (notion-article-node spec):
   * - article notion → auto-create the Document (same slug), link it via
   *   `notionPageId`, then navigate into the workspace (Req 2).
   * - role/skill → auto-create a Roadmap and link it via `linkedRoadmapId`
   *   (Req 11).
   * Node creation failing stops everything — no orphan Document/Roadmap
   * (Req 2.7). The dependent step failing leaves the node unlinked with a
   * warning toast; it never rolls the node back (Req 2.4/11.4).
   */
  const createNode = useCallback(
    async (
      input: Omit<CreateNodeInput, "roadmapId">
    ): Promise<RoadmapNode | null> => {
      let node: RoadmapNode
      try {
        node = await service.createNode({ ...input, roadmapId }, role)
        pushHistory()
        setNodes((prev) =>
          prev.some((n) => n.id === node.id) ? prev : [...prev, node]
        )
        setIsDirty(true)
        void refreshAllNodes()
        toast.success(TOAST_MESSAGES.CREATE_SUCCESS)
      } catch (error) {
        toast.error(serviceErrorMessage(error))
        return null
      }

      // Req 2: article notion node → Document with the SAME slug (join key),
      // parented under the chapter's root doc so it appears in the sidebar.
      if (
        input.nodeType === "article" &&
        input.articleType === "notion" &&
        onCreateNotionDoc
      ) {
        const parent = nodesRef.current.find((n) => n.id === input.parentId)
        const chapterSlug =
          parent?.nodeType === "chapter" && parent.slug
            ? parent.slug
            : undefined
        const doc = await onCreateNotionDoc(
          node.slug,
          node.title,
          chapterSlug
        ).catch(() => null)
        if (!doc) {
          toast.warning(
            "Không thể tạo trang Notion. Node đã được tạo nhưng chưa được liên kết."
          )
        } else {
          try {
            await service.updateNode(node.id, { notionPageId: doc.id }, role)
            applyNodePatch(node.id, { notionPageId: doc.id }, { dirty: false })
            // Req 2.3/2.6: open the workspace only when the parent chapter is
            // known — the URL is rooted at the chapter slug.
            if (chapterSlug) {
              window.location.assign(
                `/notion/${chapterSlug}?page=${encodeURIComponent(node.slug)}`
              )
            }
          } catch (error) {
            // Req 2.5: keep the pair traceable for manual re-linking.
            console.error("[notion-article-node] notionPageId update failed", {
              nodeId: node.id,
              documentId: doc.id,
              slug: node.slug,
              error,
            })
            toast.warning("Node đã tạo nhưng không thể lưu liên kết Notion.")
          }
        }
      }

      // A role/skill node IS a roadmap: its "detail" is a view of THIS same
      // tree rooted at the node (node + its descendants). No separate Roadmap
      // record is created and no seed node is added — one node, one record.
      return node
    },
    [
      service,
      roadmapId,
      role,
      refreshAllNodes,
      pushHistory,
      applyNodePatch,
      onCreateNotionDoc,
    ]
  )

  /**
   * Drop an existing sidebar node onto the canvas (Req 3.4).
   *
   * A node belonging to ANOTHER roadmap is MOVED into this one (single owner:
   * `Node.roadmapId`). No clone, no side effects — the node keeps its
   * identity, slug and linked resources; the source roadmap loses it and its
   * children there are detached server-side. Nodes that already belong to
   * this roadmap are just re-attached locally.
   */
  const addExistingToCanvas = useCallback(
    async (node: RoadmapNode, position: { x: number; y: number }) => {
      if (node.roadmapId !== roadmapId) {
        try {
          const moved = await service.moveNode(node.id, roadmapId, position, role)
          pushHistory()
          setNodes((prev) =>
            prev.some((n) => n.id === moved.id) ? prev : [...prev, moved]
          )
          void refreshAllNodes()
          toast.success("Đã chuyển node vào roadmap này")
        } catch (error) {
          toast.error(serviceErrorMessage(error))
        }
        return
      }
      if (nodesRef.current.some((n) => n.id === node.id)) return
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
    [roadmapId, service, role, pushHistory, refreshAllNodes]
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
          previous.slug &&
          onTitleSync
        ) {
          // Best-effort (Req 3.5): the node title is already saved; a failed
          // Document sync only warns, never rolls back.
          Promise.resolve(
            onTitleSync(previous.slug, input.title.trim())
          ).catch(() => {
            toast.warning(
              "Đã lưu tên node nhưng không thể đồng bộ với Notion page."
            )
          })
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
   * Permanent system delete (Req 4.3). The node and its descendants disappear
   * from the canvas immediately — deleted nodes are never rendered as ghosts.
   */
  const deleteNodePermanent = useCallback(
    async (id: string): Promise<boolean> => {
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
        setNodes((prev) => prev.filter((n) => !doomed.has(n.id)))
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
