"use client"

import { createContext, useContext } from "react"

import type { RoadmapNode } from "../../types"

/**
 * Read-only canvas snapshot for deep children (custom nodes render inside
 * React Flow and can't take props from the page). Keeps hover previews and
 * child counts in sync with the working copy.
 */
export interface BuilderCanvasContextValue {
  nodes: RoadmapNode[]
  /** True while any node is being dragged — suppresses hover previews. */
  isDragging: boolean
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
