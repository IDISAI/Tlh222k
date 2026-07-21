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

  it("chapter in builder → its own composition canvas {base}/{id}", () => {
    expect(
      nodeNavigationUrl(
        node({ nodeType: "chapter", id: "nd-3", slug: "nhap-mon-html" }),
        { builderBasePath: "/roadmaps" }
      )
    ).toBe("/roadmaps/nd-3")
  })

  it("chapter in builder ignores slug (id-based, LEGO model)", () => {
    expect(
      nodeNavigationUrl(node({ nodeType: "chapter", id: "nd-4", slug: "" }), {
        builderBasePath: "/roadmaps",
      })
    ).toBe("/roadmaps/nd-4")
  })

  it("chapter in viewer → /roadmap/{slug}", () => {
    expect(
      nodeNavigationUrl(node({ nodeType: "chapter", slug: "nhap-mon-html" }))
    ).toBe("/roadmap/nhap-mon-html")
  })

  it("role/skill in builder → its own composition canvas {base}/{id}", () => {
    expect(
      nodeNavigationUrl(
        node({ nodeType: "role", id: "nd-7", roadmapId: "rm-1" }),
        { builderBasePath: "/roadmaps" }
      )
    ).toBe("/roadmaps/nd-7")
    expect(
      nodeNavigationUrl(
        node({ nodeType: "skill", id: "nd-8", roadmapId: "rm-2" }),
        { builderBasePath: "/roadmaps" }
      )
    ).toBe("/roadmaps/nd-8")
  })

  // Property: every block's builder URL is {base}/{id}.
  it("Property: builder block URLs always match /{base}/{id}", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("role", "skill", "chapter") as fc.Arbitrary<
          RoadmapNode["nodeType"]
        >,
        fc.string({ minLength: 1 }).map(slugify),
        (nodeType, id) => {
          const url = nodeNavigationUrl(node({ nodeType, id }), {
            builderBasePath: "/roadmaps",
          })
          expect(url).toBe(`/roadmaps/${id}`)
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
