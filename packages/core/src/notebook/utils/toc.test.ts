import { describe, expect, it } from "vitest"

import { NotebookService } from "../notebook.service"
import type { Notebook } from "../types"
import { headingSlugsByCell } from "./toc"

const service = new NotebookService()

function notebookOf(...sources: string[]): Notebook {
  return {
    title: "Demo",
    language: "python",
    cells: sources.map((source, index) => ({
      id: `cell-${index}`,
      cellType: "markdown",
      source,
      executionCount: null,
      outputs: [],
    })),
    metadata: {},
  }
}

describe("extractToc anchors", () => {
  it("gives two cells with the same heading different anchors", () => {
    const toc = service.extractToc(notebookOf("## Ví dụ\n", "## Ví dụ\n"))

    expect(toc.map((entry) => entry.slug)).toEqual(["vi-du", "vi-du-1"])
  })

  it("disambiguates repeats inside one cell too", () => {
    const toc = service.extractToc(notebookOf("## Bước\n\n## Bước\n"))

    expect(toc.map((entry) => entry.slug)).toEqual(["buoc", "buoc-1"])
  })

  it("leaves distinct headings alone", () => {
    const toc = service.extractToc(notebookOf("# Mở đầu\n", "## Kết luận\n"))

    expect(toc.map((entry) => entry.slug)).toEqual(["mo-dau", "ket-luan"])
  })
})

describe("headingSlugsByCell", () => {
  it("hands each cell its own anchors, in document order", () => {
    const notebook = notebookOf("## Ví dụ\n\n## Bước\n", "## Ví dụ\n")

    const byCell = headingSlugsByCell(service.extractToc(notebook))

    expect(byCell.get("cell-0")).toEqual(["vi-du", "buoc"])
    // The repeat lives in another cell, and still gets the suffixed anchor —
    // which is the whole point: MarkdownCell cannot work this out alone.
    expect(byCell.get("cell-1")).toEqual(["vi-du-1"])
  })

  it("omits cells that contribute no headings", () => {
    const byCell = headingSlugsByCell(
      service.extractToc(notebookOf("chỉ là văn xuôi\n", "## Có tiêu đề\n"))
    )

    expect(byCell.has("cell-0")).toBe(false)
    expect(byCell.get("cell-1")).toEqual(["co-tieu-de"])
  })
})
