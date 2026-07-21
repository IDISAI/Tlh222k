// Domain layer — node taxonomy and hierarchy rules. Pure, no side effects.

export type NodeType = "role" | "skill" | "chapter" | "article"
export type ArticleType = "notion" | "jupyter"
export type NodeStatus = "locked" | "in_progress" | "done"

export const NODE_TYPES: readonly NodeType[] = [
  "role",
  "skill",
  "chapter",
  "article",
]

export const NODE_TYPE_LEVEL: Record<NodeType, number> = {
  role: 1,
  skill: 2,
  chapter: 3,
  article: 4,
}

export const MAX_CHILDREN = 100
export const MAX_TITLE_LENGTH = 150

/**
 * Parent→child validity. Base rule is level + 1. `article` is special: it may
 * attach under ANY level and may have `article` children (relaxed rule).
 */
export function validateHierarchy(
  parentType: NodeType,
  childType: NodeType
): boolean {
  if (childType === "article") return true
  return NODE_TYPE_LEVEL[childType] === NODE_TYPE_LEVEL[parentType] + 1
}

export function isNodeType(v: unknown): v is NodeType {
  return typeof v === "string" && (NODE_TYPES as readonly string[]).includes(v)
}
