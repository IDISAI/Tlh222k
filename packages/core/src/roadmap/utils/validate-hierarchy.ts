import { NODE_TYPE_LEVEL, NODE_TYPES, type NodeType } from "../types"

/**
 * Parent→child validity. The base rule is level + 1 (role→skill, skill→chapter,
 * chapter→article). `article` is special: it may attach under a node of ANY
 * level, and an `article` may itself have `article` children — so an article
 * link is always valid as long as the child is an article.
 */
export function validateHierarchy(
  parentType: NodeType,
  childType: NodeType
): boolean {
  if (childType === "article") return true
  return NODE_TYPE_LEVEL[childType] === NODE_TYPE_LEVEL[parentType] + 1
}

/**
 * NodeTypes allowed as direct children of `parentType`. Always includes
 * `article` (attachable anywhere); plus the natural level + 1 type. An
 * `article` parent therefore allows only `article` children.
 */
export function allowedChildTypes(parentType: NodeType): NodeType[] {
  const childLevel = NODE_TYPE_LEVEL[parentType] + 1
  const allowed = new Set<NodeType>(
    NODE_TYPES.filter((t) => NODE_TYPE_LEVEL[t] === childLevel)
  )
  allowed.add("article")
  return NODE_TYPES.filter((t) => allowed.has(t))
}
