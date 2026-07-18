import { RoadmapError } from "../common/roadmap-error"

export interface TreeNodeRef {
  id: string
  parentId: string | null
}

function invalidTree(): never {
  throw new RoadmapError("INVALID_HIERARCHY", "INVALID_TREE")
}

/** Reject malformed forests before any parent-link write reaches Prisma. */
export function assertAcyclicTree(nodes: readonly TreeNodeRef[]): void {
  const parents = new Map<string, string | null>()
  for (const node of nodes) {
    if (parents.has(node.id)) invalidTree()
    parents.set(node.id, node.parentId)
  }

  for (const node of nodes) {
    const seen = new Set<string>([node.id])
    let parentId = node.parentId
    while (parentId) {
      if (!parents.has(parentId) || seen.has(parentId)) invalidTree()
      seen.add(parentId)
      parentId = parents.get(parentId) ?? null
    }
  }
}
