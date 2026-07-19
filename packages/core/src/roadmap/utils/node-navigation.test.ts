import fc from "fast-check"
import { describe, expect, it } from "vitest"

import type { RoadmapNode } from "../types"
import { navigationBlockedMessage, nodeNavigationUrl } from "./node-navigation"
import { slugify } from "./slugify"

function node(overrides: Partial<RoadmapNode>): RoadmapNode {
  return {
    id: "node-id",
    roadmapId: "rm-1",
    parentId: null,
    title: "HTML cơ bản",
    notionPageId: null,
    positionX: 0,
    positionY: 0,
    order: 0,
    status: "locked",
    nodeType: "article",
    slug: "html-co-ban",
    description: null,
    articleType: "notion",
    jupyterUrl: null,
    ...overrides,
  }
}

describe("nodeNavigationUrl (notion-article-node Req 1/10/11)", () => {
  it("linked notion article → /notion/{chapter}?page={slug}", () => {
    expect(
      nodeNavigationUrl(node({ notionPageId: "doc-1" }), {
        parentChapterSlug: "nhap-mon-html",
      })
    ).toBe("/notion/nhap-mon-html?page=html-co-ban")
  })

  it("unlinked notion article → null (Req 1.3)", () => {
    expect(nodeNavigationUrl(node({}))).toBeNull()
  })

  it("jupyter article → notebook base path", () => {
    expect(
      nodeNavigationUrl(
        node({ articleType: "jupyter", jupyterUrl: "https://x" }),
        { notebookBasePath: "/notebooks" }
      )
    ).toBe("/notebooks/html-co-ban")
  })

  it("chapter in builder → chapter detail page (Req 10.1)", () => {
    expect(
      nodeNavigationUrl(
        node({ nodeType: "chapter", slug: "nhap-mon-html" }),
        { builderBasePath: "/roadmaps" }
      )
    ).toBe("/roadmaps/rm-1/chapter/nhap-mon-html")
  })

  it("chapter with empty slug in builder → null (Req 10.6)", () => {
    expect(
      nodeNavigationUrl(node({ nodeType: "chapter", slug: "" }), {
        builderBasePath: "/roadmaps",
      })
    ).toBeNull()
  })

  it("chapter in viewer → /roadmap/{slug}", () => {
    expect(
      nodeNavigationUrl(node({ nodeType: "chapter", slug: "nhap-mon-html" }))
    ).toBe("/roadmap/nhap-mon-html")
  })

  it("role/skill in builder → rooted view of its own roadmap (never null)", () => {
    expect(
      nodeNavigationUrl(
        node({ nodeType: "role", id: "nd-7", roadmapId: "rm-1" }),
        { builderBasePath: "/roadmaps" }
      )
    ).toBe("/roadmaps/rm-1?node=nd-7")
    expect(
      nodeNavigationUrl(
        node({ nodeType: "skill", id: "nd-8", roadmapId: "rm-2" }),
        { builderBasePath: "/roadmaps" }
      )
    ).toBe("/roadmaps/rm-2?node=nd-8")
  })

  // Tag: Feature: notion-article-node, Property 9: chapter URL format
  it("Property 9: builder chapter URLs always match /{base}/{roadmapId}/chapter/{slug}", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).map(slugify),
        fc.string({ minLength: 1 }).map(slugify),
        (chapterSlug, roadmapId) => {
          const url = nodeNavigationUrl(
            node({ nodeType: "chapter", slug: chapterSlug, roadmapId }),
            { builderBasePath: "/roadmaps" }
          )
          expect(url).toBe(`/roadmaps/${roadmapId}/chapter/${chapterSlug}`)
        }
      ),
      { numRuns: 500 }
    )
  })
})

describe("navigationBlockedMessage", () => {
  it("names the block reason per node type", () => {
    expect(navigationBlockedMessage(node({ nodeType: "chapter" }))).toBe(
      "Không thể điều hướng đến chapter này"
    )
    expect(navigationBlockedMessage(node({ nodeType: "role" }))).toBe(
      "Node này chưa được liên kết với roadmap nào."
    )
    expect(navigationBlockedMessage(node({}))).toBe(
      "Trang Notion chưa được tạo cho node này"
    )
  })
})
