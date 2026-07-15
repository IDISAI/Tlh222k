import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { RoadmapNode } from "../../types"
import { NodeDetailDialog } from "./NodeDetailDialog"

function jupyterArticle(): RoadmapNode {
  return {
    id: "article-id",
    roadmapId: "roadmap-id",
    parentId: null,
    title: "CSS Grid lab",
    notionPageId: null,
    positionX: 0,
    positionY: 0,
    order: 0,
    status: "locked",
    nodeType: "article",
    slug: "css-grid-lab",
    description: null,
    articleType: "jupyter",
    jupyterUrl: null,
  }
}

describe("NodeDetailDialog", () => {
  it("keeps the notebook document link inside the admin zone", () => {
    window.history.pushState({}, "", "/admin/roadmap/frontend")
    const node = jupyterArticle()

    render(
      <NodeDetailDialog
        node={node}
        nodes={[node]}
        notebookBasePath="/notebooks"
        onClose={() => undefined}
      />
    )

    expect(screen.getByRole("link", { name: "/admin/notebooks/css-grid-lab" }).getAttribute("href"))
      .toBe("/admin/notebooks/css-grid-lab")
  })
})
