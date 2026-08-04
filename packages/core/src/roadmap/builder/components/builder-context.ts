"use client"

import { createContext, useContext } from "react"

import type { Composition, RoadmapNode } from "../../types"

/**
 * Read-only canvas snapshot for deep children (custom nodes render inside
 * React Flow and can't take props from the page). Keeps hover previews and
 * child counts in sync with the working copy.
 */
export interface BuilderCanvasContextValue {
  nodes: RoadmapNode[]
  /** True while any node is being dragged — suppresses hover previews. */
  isDragging: boolean
  /** The currently-rendered canvas's own composition, when this IS a LEGO
   * composition canvas (CompositionCanvas/ViewerCanvas). `null`/omitted on
   * the legacy tree BuilderCanvas, which has no composition concept. */
  composition?: Composition | null
}

export const BuilderCanvasContext = createContext<BuilderCanvasContextValue>({
  nodes: [],
  isDragging: false,
})

export function useBuilderCanvasContext(): BuilderCanvasContextValue {
  return useContext(BuilderCanvasContext)
}

/** Direct children of `nodeId` among the given nodes (deleted ones excluded). */
export function childrenOf(nodes: RoadmapNode[], nodeId: string): RoadmapNode[] {
  return nodes.filter((n) => n.parentId === nodeId && !n.isDeleted)
}

/**
 * Direct children, parentId tree ∪ composition membership, deduplicated by
 * id. See `directChildCount` for why `parentId` alone under-reads.
 */
export function directChildrenOf(
  nodes: RoadmapNode[],
  composition: Composition | null | undefined,
  nodeId: string
): RoadmapNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const result = new Map<string, RoadmapNode>()
  for (const child of childrenOf(nodes, nodeId)) result.set(child.id, child)
  if (composition && composition.ownerId === nodeId) {
    for (const member of composition.members) {
      const node = byId.get(member.nodeId)
      if (node && !node.isDeleted) result.set(node.id, node)
    }
  }
  return [...result.values()]
}

/**
 * Direct children count, parentId tree ∪ composition membership. Composition
 * is the real LEGO canvas relation for role/skill/chapter children —
 * `parentId` only still carries article leaves — so a plain `childrenOf`
 * silently reads 0 for anything placed by dragging it onto the canvas.
 */
export function directChildCount(
  nodes: RoadmapNode[],
  composition: Composition | null | undefined,
  nodeId: string
): number {
  return (
    childrenOf(nodes, nodeId).length +
    (composition && composition.ownerId === nodeId
      ? composition.members.length
      : 0)
  )
}

/** Subtree under `nodeId` limited to `maxDepth` levels (Req 5.4: 2). */
export function subtreeOf(
  nodes: RoadmapNode[],
  nodeId: string,
  maxDepth: number
): RoadmapNode[] {
  const result: RoadmapNode[] = []
  let frontier = [nodeId]
  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const child of childrenOf(nodes, id)) {
        result.push(child)
        next.push(child.id)
      }
    }
    frontier = next
  }
  return result
}
