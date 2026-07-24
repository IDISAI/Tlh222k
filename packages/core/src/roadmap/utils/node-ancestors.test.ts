import { describe, expect, it } from "vitest"

import type { RoadmapNode } from "../types"
import { ancestorPath } from "./node-ancestors"

function node(
  id: string,
  nodeType: RoadmapNode["nodeType"],
  parentId: string | null
): RoadmapNode {
  return {
    id,
    roadmapId: "r1",
    parentId,
    title: id.toUpperCase(),
    slug: id,
    nodeType,
    positionX: 0,
    positionY: 0,
    order: 0,
    status: "locked",
    isDeleted: false,
    isPublished: true,
    description: null,
    notionPageId: null,
    articleType: null,
    jupyterUrl: null,
  }
}

const ROLE = node("role", "role", null)
const SKILL = node("skill", "skill", "role")
const CHAPTER = node("chapter", "chapter", "skill")
const ARTICLE = node("article", "article", "chapter")
const NODES = [ARTICLE, CHAPTER, ROLE, SKILL]

describe("ancestorPath", () => {
  it("walks an article up to the outermost block", () => {
    expect(ancestorPath(NODES, ARTICLE).map((n) => n.id)).toEqual([
      "role",
      "skill",
      "chapter",
      "article",
    ])
  })

  it("returns just the node when it has no parent", () => {
    expect(ancestorPath(NODES, ROLE).map((n) => n.id)).toEqual(["role"])
  })

  it("stops where the chain leaves the loaded set", () => {
    const orphan = node("orphan", "article", "missing-chapter")
    expect(ancestorPath(NODES, orphan).map((n) => n.id)).toEqual(["orphan"])
  })

  it("does not hang on a corrupt parent cycle", () => {
    const a = node("a", "chapter", "b")
    const b = node("b", "chapter", "a")
    expect(ancestorPath([a, b], a).map((n) => n.id)).toEqual(["b", "a"])
  })
})
