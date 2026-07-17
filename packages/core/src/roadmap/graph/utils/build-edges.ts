import type { Edge } from "@xyflow/react"

import type { RoadmapNode } from "../../types"

/**
 * Build React Flow edges from `parentId` links. Dangling parents are skipped so
 * the rendered tree stays consistent (R2 — Node Tree Integrity).
 */
export function buildEdges(nodes: RoadmapNode[]): Edge[] {
  const ids = new Set(nodes.map((n) => n.id))
  return nodes
    .filter((n) => n.parentId !== null && ids.has(n.parentId))
    .map((n) => ({
      id: `${n.parentId}->${n.id}`,
      source: n.parentId as string,
      target: n.id,
    }))
}
