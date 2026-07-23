import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import type { TocEntry } from "../types"
import { NotebookWorkspace } from "./NotebookWorkspace"

afterEach(cleanup)

const TOC: TocEntry[] = [
  { cellId: "a", slug: "intro", text: "Intro", level: 2 },
  { cellId: "b", slug: "loops", text: "Loops", level: 3 },
]

function columns(container: HTMLElement): string[] {
  const row = container.firstElementChild!
  return [...row.children].map((child) => child.tagName)
}

describe("NotebookWorkspace", () => {
  it("puts the table of contents left and the notebook after it", () => {
    const { container } = render(
      <NotebookWorkspace toc={TOC}>
        <p>cells</p>
      </NotebookWorkspace>
    )

    expect(columns(container)).toEqual(["ASIDE", "DIV"])
    expect(
      within(screen.getByLabelText("Table of contents")).getByText("Loops")
    ).toBeDefined()
  })

  it("puts the visualization panel in the last column", () => {
    const { container } = render(
      <NotebookWorkspace toc={TOC} panel={<p>panel</p>}>
        <p>cells</p>
      </NotebookWorkspace>
    )

    const cols = columns(container)
    expect(cols).toEqual(["ASIDE", "DIV", "ASIDE"])
    expect(container.firstElementChild!.className).toContain("max-w-7xl")
  })

  it("omits the sidebar when the notebook has no headings", () => {
    const { container } = render(
      <NotebookWorkspace toc={[]}>
        <p>cells</p>
      </NotebookWorkspace>
    )

    expect(columns(container)).toEqual(["DIV"])
    expect(container.firstElementChild!.className).toContain("max-w-6xl")
  })

  it("lets a host that scrolls its own pane move the sticky offset", () => {
    const { container } = render(
      <NotebookWorkspace toc={TOC} stickyClassName="top-4">
        <p>cells</p>
      </NotebookWorkspace>
    )

    const sidebar = container.querySelector("aside")!
    expect(sidebar.className).toContain("top-4")
    expect(sidebar.className).not.toContain("top-24")
  })
})
