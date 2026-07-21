"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "@workspace/ui/components/sonner"

import { RoadmapService } from "../../api"
import type {
  ArticleType,
  CallerRole,
  Composition,
  EdgeKind,
  NodeType,
  RoadmapNode,
  UpdateNodeInput,
} from "../../types"
import {
  TOAST_MESSAGES,
  serviceErrorMessage,
  createSuccessMessage,
  updateSuccessMessage,
  deleteSuccessMessage,
} from "../utils/toast-messages"

/** A member block resolved to its node plus its position on this canvas. */
export interface CompositionMemberNode {
  node: RoadmapNode
  x: number
  y: number
}

/**
 * State for ONE owner block's canvas (LEGO composition model). Unlike the old
 * batch-saved tree builder, every op persists immediately — membership, edges
 * and positions are independent records, so there is no "Lưu" step.
 */
export function useCompositionCanvas(
  ownerId: string,
  role: CallerRole,
  opts?: {
    onCreateNotionDoc?: (
      slug: string,
      title: string,
      parentChapterSlug?: string
    ) => Promise<{ id: string } | null>
    onSyncPublish?: (notionPageId: string, isPublished: boolean) => Promise<void>
  }
) {
  const onCreateNotionDoc = opts?.onCreateNotionDoc
  const onSyncPublish = opts?.onSyncPublish
  const service = useMemo(() => new RoadmapService(), [])

  const [ownerNode, setOwnerNode] = useState<RoadmapNode | null>(null)
  const [composition, setComposition] = useState<Composition | null>(null)
  const [allNodes, setAllNodes] = useState<RoadmapNode[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // ── Undo / Redo history ───────────────────────────────────────────────────
  const historyRef = useRef<Composition[]>([])
  const historyIdxRef = useRef(-1)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const pushHistory = useCallback((comp: Composition) => {
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1)
    historyRef.current.push(comp)
    historyIdxRef.current = historyRef.current.length - 1
    setCanUndo(historyIdxRef.current > 0)
    setCanRedo(false)
  }, [])

  const load = useCallback(async () => {
    try {
      const [all, comp] = await Promise.all([
        service.listNodes(),
        service.getComposition(ownerId, { callerRole: role }),
      ])
      const owner = all.find((n) => n.id === ownerId && !n.isDeleted) ?? null
      if (!owner) setNotFound(true)
      else {
        setOwnerNode(owner)
        setComposition(comp)
        // Seed undo history from initial load
        historyRef.current = [comp]
        historyIdxRef.current = 0
        setCanUndo(false)
        setCanRedo(false)
      }
      setAllNodes(all)
    } catch (error) {
      toast.error(serviceErrorMessage(error))
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [service, ownerId, role])

  useEffect(() => {
    void load()
    const handleRestore = () => void load()
    window.addEventListener("bfcache-restore", handleRestore)
    return () => window.removeEventListener("bfcache-restore", handleRestore)
  }, [load])

  const nodeById = useMemo(
    () => new Map(allNodes.map((n) => [n.id, n])),
    [allNodes]
  )

  const memberNodes = useMemo<CompositionMemberNode[]>(() => {
    if (!composition) return []
    return composition.members
      .map((m) => {
        const node = nodeById.get(m.nodeId)
        return node && !node.isDeleted ? { node, x: m.x, y: m.y } : null
      })
      .filter((v): v is CompositionMemberNode => v !== null)
  }, [composition, nodeById])

  const refreshNodes = useCallback(async () => {
    setAllNodes(await service.listNodes())
  }, [service])

  const refreshComposition = useCallback(async () => {
    const comp = await service.getComposition(ownerId, { callerRole: role })
    setComposition(comp)
    pushHistory(comp)
    // No need to call refreshNodes here - let callers decide if they need it
  }, [service, ownerId, role, pushHistory])

  const undo = useCallback(async () => {
    if (historyIdxRef.current <= 0) return
    historyIdxRef.current--
    const prev = historyRef.current[historyIdxRef.current]!
    setComposition(prev)
    setCanUndo(historyIdxRef.current > 0)
    setCanRedo(true)
    try {
      await service.restoreComposition(ownerId, prev, role)
      await refreshNodes()
    } catch {
      // Apollo: no-op, UI state already restored above
    }
  }, [service, ownerId, role, refreshNodes])

  const redo = useCallback(async () => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return
    historyIdxRef.current++
    const next = historyRef.current[historyIdxRef.current]!
    setComposition(next)
    setCanUndo(true)
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1)
    try {
      await service.restoreComposition(ownerId, next, role)
      await refreshNodes()
    } catch {
      // Apollo: no-op
    }
  }, [service, ownerId, role, refreshNodes])

  const addMember = useCallback(
    async (nodeId: string, position: { x: number; y: number }) => {
      try {
        const comp = await service.addMember(ownerId, nodeId, position, role)
        setComposition(comp)
        pushHistory(comp)
        // No need to refreshNodes - composition already updated, membership change doesn't affect allNodes
        toast.success("Đã thêm vào canvas")
      } catch (error) {
        toast.error(serviceErrorMessage(error))
      }
    },
    [service, ownerId, role, pushHistory]
  )

  const removeFromCanvas = useCallback(
    async (nodeId: string) => {
      try {
        const comp = await service.removeFromCanvas(ownerId, nodeId, role)
        setComposition(comp)
        pushHistory(comp)
        // No need to refreshNodes - composition already updated, membership change doesn't affect allNodes
        toast.success("Đã gỡ khỏi canvas")
      } catch (error) {
        toast.error(serviceErrorMessage(error))
      }
    },
    [service, ownerId, role, pushHistory]
  )

  /** Optimistic position update; persisted in the background on drag stop. */
  const moveMember = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      setComposition((prev) =>
        prev
          ? nodeId === ownerId
            ? { ...prev, ownerX: position.x, ownerY: position.y }
            : {
                ...prev,
                members: prev.members.map((m) =>
                  m.nodeId === nodeId ? { ...m, x: position.x, y: position.y } : m
                ),
              }
          : prev
      )
      void service
        .moveMember(ownerId, nodeId, position, role)
        .catch((error) => toast.error(serviceErrorMessage(error)))
    },
    [service, ownerId, role]
  )

  const createBlock = useCallback(
    async (input: {
      nodeType: NodeType
      title: string
      description?: string
      positionX: number
      positionY: number
    }): Promise<RoadmapNode | null> => {
      try {
        const node = await service.createBlock({ ...input, ownerId }, role)
        await refreshComposition()
        await refreshNodes() // Need to refresh nodes after creating a new block
        toast.success(createSuccessMessage(input.title))
        return node
      } catch (error) {
        toast.error(serviceErrorMessage(error))
        return null
      }
    },
    [service, ownerId, role, refreshComposition, refreshNodes]
  )

  const createArticle = useCallback(
    async (input: {
      chapterId: string
      title: string
      articleType: ArticleType
    }): Promise<RoadmapNode | null> => {
      let node: RoadmapNode
      try {
        node = await service.createArticle(input, role)
        await refreshNodes()
        toast.success(createSuccessMessage(input.title))
      } catch (error) {
        toast.error(serviceErrorMessage(error))
        return null
      }

      // notion-article-node Req 2: auto-create Document (same slug), link via
      // notionPageId, then open the workspace. Jupyter articles are internal —
      // slug routes to /notebooks/[slug]; jupyterUrl is legacy metadata.
      if (input.articleType === "notion" && onCreateNotionDoc) {
        const chapter = allNodes.find((n) => n.id === input.chapterId)
        const chapterSlug =
          chapter?.nodeType === "chapter" && chapter.slug
            ? chapter.slug
            : undefined
        const doc = await onCreateNotionDoc(
          node.slug,
          node.title,
          chapterSlug
        ).catch(() => null)
        if (!doc) {
          toast.warning(
            "Không thể tạo trang Notion. Bài viết đã được tạo nhưng chưa được liên kết."
          )
        } else {
          try {
            await service.updateNode(node.id, { notionPageId: doc.id }, role)
            await refreshNodes()
            if (chapterSlug) {
              window.location.assign(
                `/notion/${chapterSlug}?page=${encodeURIComponent(node.slug)}`
              )
            }
          } catch (error) {
            console.error("[notion-article-node] notionPageId update failed", {
              nodeId: node.id,
              documentId: doc.id,
              slug: node.slug,
              error,
            })
            toast.warning(
              "Bài viết đã tạo nhưng không thể lưu liên kết Notion."
            )
          }
        }
      }

      return node
    },
    [service, role, refreshNodes, onCreateNotionDoc, allNodes]
  )

  const deleteBlockPermanent = useCallback(
    async (nodeId: string): Promise<boolean> => {
      try {
        const node = allNodes.find((n) => n.id === nodeId)
        const title = node?.title || "node"
        await service.deleteBlockPermanent(nodeId, role)
        await refreshComposition()
        await refreshNodes() // Need to refresh nodes after permanent delete
        toast.success(deleteSuccessMessage(title))
        return true
      } catch (error) {
        toast.error(serviceErrorMessage(error))
        return false
      }
    },
    [service, role, refreshComposition, refreshNodes, allNodes]
  )

  const addEdge = useCallback(
    async (sourceId: string, targetId: string, kind: EdgeKind = "solid") => {
      try {
        await service.addEdge(ownerId, sourceId, targetId, kind, role)
        await refreshComposition()
      } catch (error) {
        toast.error(serviceErrorMessage(error))
      }
    },
    [service, ownerId, role, refreshComposition]
  )

  const updateEdgeKind = useCallback(
    async (edgeId: string, kind: EdgeKind) => {
      try {
        await service.updateEdgeKind(ownerId, edgeId, kind, role)
        await refreshComposition()
      } catch (error) {
        toast.error(serviceErrorMessage(error))
      }
    },
    [service, ownerId, role, refreshComposition]
  )

  const removeEdge = useCallback(
    async (edgeId: string) => {
      try {
        const comp = await service.removeEdge(ownerId, edgeId, role)
        setComposition(comp)
        pushHistory(comp)
        await refreshNodes()
      } catch (error) {
        toast.error(serviceErrorMessage(error))
      }
    },
    [service, ownerId, role, pushHistory, refreshNodes]
  )

  const updateNodeMeta = useCallback(
    async (id: string, input: UpdateNodeInput): Promise<boolean> => {
      try {
        await service.updateNode(id, input, role)
        await refreshNodes()
        // Keep the owner header in sync if the owner itself was edited.
        if (id === ownerId) {
          setOwnerNode((prev) => (prev ? { ...prev, ...input } : prev))
        }
        // Sync publish state to Notion document if available
        if (input.isPublished !== undefined && onSyncPublish) {
          const node = allNodes.find((n) => n.id === id)
          const notionKey = node?.notionPageId || node?.slug
          if (notionKey) {
            await onSyncPublish(notionKey, input.isPublished).catch(console.error)
          }
        }
        const node = allNodes.find((n) => n.id === id)
        const title = node?.title || "node"
        toast.success(updateSuccessMessage(title))
        return true
      } catch (error) {
        toast.error(serviceErrorMessage(error))
        return false
      }
    },
    [service, role, ownerId, refreshNodes, onSyncPublish, allNodes]
  )

  return {
    service,
    role,
    ownerNode,
    composition,
    allNodes,
    memberNodes,
    edges: composition?.edges ?? [],
    loading,
    notFound,
    canUndo,
    canRedo,
    undo,
    redo,
    addMember,
    removeFromCanvas,
    moveMember,
    createBlock,
    createArticle,
    deleteBlockPermanent,
    addEdge,
    updateEdgeKind,
    removeEdge,
    updateNodeMeta,
    refreshNodes,
    reload: load,
  }
}

export type CompositionCanvasApi = ReturnType<typeof useCompositionCanvas>
