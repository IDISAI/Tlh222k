import { describe, expect, it } from "vitest"

import type { RoadmapNode } from "../types"
import { resolveArticleTarget } from "./resolve-article-target"

function node(overrides: Partial<RoadmapNode>): RoadmapNode {
  return {
    id: "node-id",
    roadmapId: "roadmap-id",
    parentId: "chapter-id",
    title: "NumPy basics",
    notionPageId: null,
    positionX: 0,
    positionY: 0,
    order: 0,
    status: "locked",
    nodeType: "article",
    slug: "numpy-basics",
    description: null,
    articleType: "jupyter",
    jupyterUrl: null,
    ...overrides,
  }
}

describe("resolveArticleTarget", () => {
  it("keeps a Jupyter article internal even when legacy jupyterUrl is absolute", () => {
    expect(
      resolveArticleTarget(
        node({
          articleType: "jupyter",
          jupyterUrl: "https://colab.research.google.com/x",
        })
      )
    ).toEqual({ kind: "internal", slug: "numpy-basics" })
  })

  it("routes a Notion article to the INTERNAL workspace even when a legacy notionPageId exists", () => {
    expect(
      resolveArticleTarget(
        node({ articleType: "notion", notionPageId: "page-id" })
      )
    ).toEqual({ kind: "internal", slug: "numpy-basics" })
  })

  it("routes a Notion article without legacy metadata internally too", () => {
    expect(
      resolveArticleTarget(node({ articleType: "notion", notionPageId: null }))
    ).toEqual({ kind: "internal", slug: "numpy-basics" })
  })

  it("returns null for unlinked articles", () => {
    expect(resolveArticleTarget(node({ articleType: null }))).toBeNull()
  })

  it("returns null for non-article nodes", () => {
    expect(resolveArticleTarget(node({ nodeType: "chapter" }))).toBeNull()
  })
})
