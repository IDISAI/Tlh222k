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
  it("routes an internal jupyter article through the given notebook base path", () => {
    // The admin zone passes its own (prod-prefixed) base path; the component
    // uses it verbatim, so the notebook link stays inside the admin zone.
    const node = jupyterArticle()

    render(
      <NodeDetailDialog
        node={node}
        nodes={[node]}
        notebookBasePath="/admin/notebooks"
        onClose={() => undefined}
      />
    )

    expect(
      screen
        .getByRole("link", { name: "/admin/notebooks/css-grid-lab" })
        .getAttribute("href")
    ).toBe("/admin/notebooks/css-grid-lab")
  })
})
