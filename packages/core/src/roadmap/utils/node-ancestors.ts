import type { RoadmapNode } from "../types"

/**
 * The chain from the outermost block down to `node`, e.g.
 * role → skill → chapter → article. Answers "which chapter is this article in,
 * and which roadmap is that chapter part of" without another round trip: the
 * builder and the viewer already hold every node.
 *
 * Cycles cannot be authored, but a corrupt parentId must not hang the UI, so
 * the walk stops as soon as it revisits a node.
 */
export function ancestorPath(
  nodes: RoadmapNode[],
  node: RoadmapNode
): RoadmapNode[] {
  const byId = new Map(nodes.map((candidate) => [candidate.id, candidate]))
  const path: RoadmapNode[] = [node]
  const seen = new Set<string>([node.id])

  let current = node
  while (current.parentId) {
    const parent = byId.get(current.parentId)
    if (!parent || seen.has(parent.id)) break
    path.unshift(parent)
    seen.add(parent.id)
    current = parent
  }
  return path
}
