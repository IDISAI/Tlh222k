import type {
  Composition,
  CompositionMember,
  RoadmapNode,
  RoadmapEdge,
} from "../types"

/**
 * Bridge the legacy parentId tree into a composition: an owner's direct
 * non-article children become members at their stored positions, each wired
 * owner→child (solid). Shared by the mock store and the svc-api Apollo adapter
 * so both render the same canvas from existing tree data with no migration.
 */
function getDescendants(ownerId: string, nodes: RoadmapNode[]): Set<string> {
  const descendants = new Set<string>()
  const queue = [ownerId]
  const visited = new Set<string>(queue)
  while (queue.length > 0) {
    const currId = queue.shift()!
    const children = nodes.filter(
      (n) => n.parentId === currId && !n.isDeleted
    )
    for (const child of children) {
      if (!visited.has(child.id)) {
        visited.add(child.id)
        descendants.add(child.id)
        queue.push(child.id)
      }
    }
  }
  return descendants
}

/**
 * Bridge the legacy parentId tree into a composition: an owner's direct
 * non-article children become members at their stored positions, each wired
 * owner→child (solid). Shared by the mock store and the svc-api Apollo adapter
 * so both render the same canvas from existing tree data with no migration.
 */
export function deriveCompositionFromNodes(
  ownerId: string,
  nodes: RoadmapNode[]
): Composition {
  const owner = nodes.find((n) => n.id === ownerId)
  if (!owner) {
    return { ownerId, members: [], edges: [] }
  }

  const roadmapId = owner.roadmapId

  let memberNodes: RoadmapNode[] = []
  if (owner.parentId === null) {
    // Root canvas: shows all other non-article, non-deleted nodes in the same roadmap
    memberNodes = nodes.filter(
      (n) => n.roadmapId === roadmapId && n.id !== ownerId && !n.isDeleted && n.nodeType !== "article"
    )
  } else {
    // Sub-canvas: shows only descendants of the owner
    const descendants = getDescendants(ownerId, nodes)
    memberNodes = nodes.filter(
      (n) => descendants.has(n.id) && !n.isDeleted && n.nodeType !== "article"
    )
  }

  const members: CompositionMember[] = memberNodes.map((n) => ({
    nodeId: n.id,
    x: n.positionX,
    y: n.positionY,
  }))

  // Edges are all parent-child connections among these members (and the owner)
  const edges: RoadmapEdge[] = []
  const allCanvasNodeIds = new Set([ownerId, ...memberNodes.map((m) => m.id)])

  for (const n of memberNodes) {
    if (n.parentId && allCanvasNodeIds.has(n.parentId)) {
      edges.push({
        id: `edge-${n.parentId}-${n.id}`,
        sourceId: n.parentId,
        targetId: n.id,
        kind: "solid",
      })
    }
  }

  return { ownerId, members, edges }
}

export function parseDerivedEdge(edgeId: string): { sourceId: string; targetId: string } | null {
  if (!edgeId.startsWith("edge-")) return null
  
  const payload = edgeId.slice(5)
  
  // 1. Try to find mock prefixes (nd- or rm-)
  const lastNdIndex = payload.lastIndexOf("-nd-")
  const lastRmIndex = payload.lastIndexOf("-rm-")
  const lastIndex = Math.max(lastNdIndex, lastRmIndex)
  
  if (lastIndex !== -1) {
    return {
      sourceId: payload.slice(0, lastIndex),
      targetId: payload.slice(lastIndex + 1),
    }
  } else {
    // 2. Fall back to standard cuids (separated by the last dash)
    const lastDash = payload.lastIndexOf("-")
    if (lastDash !== -1) {
      return {
        sourceId: payload.slice(0, lastDash),
        targetId: payload.slice(lastDash + 1),
      }
    }
  }
  return null
}
