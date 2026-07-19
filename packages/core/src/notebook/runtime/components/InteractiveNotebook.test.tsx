import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { ExecuteCallbacks, ExecuteResult, KernelAdapter } from "../../kernel"
import type { Notebook } from "../../types"
import { FIXTURE_TRACE } from "../../visualize"
import { InteractiveNotebook } from "./InteractiveNotebook"

// CodeMirror needs real layout APIs; a textarea keeps source-editing behavior
// testable in jsdom.
vi.mock("../../editor/components/CodeCellEditor", () => ({
  CodeCellEditor: ({
    source,
    onChange,
  }: {
    source: string
    onChange: (source: string) => void
  }) => (
    <textarea
      aria-label="Cell source"
      value={source}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

afterEach(cleanup)

function makeNotebook(language: string, cells: Array<{ id: string; source: string }>): Notebook {
  return {
    title: "t",
    language,
    metadata: {},
    cells: cells.map(({ id, source }) => ({
      id,
      cellType: "code",
      source,
      executionCount: null,
      outputs: [],
    })),
  }
}

/** Adapter that succeeds, except sources containing "boom" emit an error output. */
function stubAdapter(): KernelAdapter {
  let count = 0
  return {
    status: "idle",
    subscribeStatus: () => () => {},
    start: async () => {},
    execute: async (code: string, callbacks?: ExecuteCallbacks): Promise<ExecuteResult> => {
      if (code.includes("boom")) {
        callbacks?.onOutput?.({ kind: "error", ename: "Boom", evalue: "boom", traceback: [] })
      } else {
        callbacks?.onStream?.("stdout", "ok\n")
      }
      return { executionCount: ++count }
    },
    interrupt: async () => {},
    restart: async () => {},
    dispose: () => {},
  }
}

const runCell = (index = 0) => {
  fireEvent.click(screen.getAllByRole("button", { name: "Run cell" })[index]!)
}
const visualizeButtons = () => screen.queryAllByRole("button", { name: /Visualize execution/ })

describe("InteractiveNotebook visualization", () => {
  it("hides the action before any successful execution", () => {
    render(
      <InteractiveNotebook
        notebook={makeNotebook("python", [{ id: "a", source: "x = 1" }])}
        adapter={stubAdapter()}
      />
    )
    expect(visualizeButtons()).toHaveLength(0)
  })

  it("shows an enabled action after a successful run; failed runs stay hidden", async () => {
    render(
      <InteractiveNotebook
        notebook={makeNotebook("python", [
          { id: "a", source: "x = 1" },
          { id: "b", source: "boom" },
        ])}
        adapter={stubAdapter()}
      />
    )
    runCell(0)
    await waitFor(() => expect(visualizeButtons()).toHaveLength(1))
    expect((visualizeButtons()[0] as HTMLButtonElement).disabled).toBe(false)

    runCell(1)
    // Cell b errored (error output rendered): still only cell a's action.
    await waitFor(() =>
      expect(screen.getAllByText("Boom", { exact: false }).length).toBeGreaterThan(0)
    )
    expect(visualizeButtons()).toHaveLength(1)
  })

  it("renders a disabled Coming soon action for non-traceable languages", () => {
    render(
      <InteractiveNotebook
        notebook={makeNotebook("cpp", [{ id: "a", source: "int x;" }])}
        adapter={stubAdapter()}
      />
    )
    const button = visualizeButtons()[0] as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.title).toContain("Coming soon")
  })

  it("hides the action when source changes after a run, until rerun", async () => {
    render(
      <InteractiveNotebook
        notebook={makeNotebook("python", [{ id: "a", source: "x = 1" }])}
        adapter={stubAdapter()}
      />
    )
    runCell()
    await waitFor(() => expect(visualizeButtons()).toHaveLength(1))

    fireEvent.change(screen.getByLabelText("Cell source"), { target: { value: "x = 2" } })
    expect(visualizeButtons()).toHaveLength(0)

    runCell()
    await waitFor(() => expect(visualizeButtons()).toHaveLength(1))
  })

  it("opens one panel, replaces it across cells, and closing preserves cell state", async () => {
    render(
      <InteractiveNotebook
        notebook={makeNotebook("python", [
          { id: "a", source: "x = 1" },
          { id: "b", source: "y = 2" },
        ])}
        adapter={stubAdapter()}
        createTrace={async ({ source }) => ({
          ...FIXTURE_TRACE,
          steps: FIXTURE_TRACE.steps.map((step) => ({
            ...step,
            stdout: [`traced:${source}`],
          })),
        })}
      />
    )
    runCell(0)
    runCell(1)
    await waitFor(() => expect(visualizeButtons()).toHaveLength(2))

    fireEvent.click(visualizeButtons()[0]!)
    const panel = () => screen.getByLabelText("Execution visualization")
    await waitFor(() => expect(panel().textContent).toContain("Step 1 of 3"))
    expect(screen.getAllByLabelText("Execution visualization")).toHaveLength(1)
    expect(within(panel()).getByLabelText("Source lines").textContent).toContain("x = 1")

    // Opening cell B replaces cell A's panel.
    fireEvent.click(visualizeButtons()[1]!)
    await waitFor(() =>
      expect(within(panel()).getByLabelText("Source lines").textContent).toContain("y = 2")
    )
    expect(screen.getAllByLabelText("Execution visualization")).toHaveLength(1)

    // Closing leaves editors and outputs intact.
    fireEvent.click(screen.getByRole("button", { name: "Close visualization" }))
    expect(screen.queryByLabelText("Execution visualization")).toBeNull()
    const sources = screen.getAllByLabelText("Cell source") as HTMLTextAreaElement[]
    expect(sources.map((s) => s.value)).toEqual(["x = 1", "y = 2"])
    expect(screen.getAllByText("ok")).toHaveLength(2)
    expect(visualizeButtons()).toHaveLength(2)
  })

  it("panel reports engine unavailable when no trace factory is injected", async () => {
    render(
      <InteractiveNotebook
        notebook={makeNotebook("python", [{ id: "a", source: "x = 1" }])}
        adapter={stubAdapter()}
      />
    )
    runCell()
    await waitFor(() => expect(visualizeButtons()).toHaveLength(1))
    fireEvent.click(visualizeButtons()[0]!)
    expect(
      screen.getByLabelText("Execution visualization").textContent
    ).toContain("not available yet")
  })

  it("keeps the TOC left of the notebook and the panel right of it", async () => {
    const notebook = makeNotebook("python", [{ id: "a", source: "x = 1" }])
    notebook.cells.unshift({
      id: "m",
      cellType: "markdown",
      source: "## Section",
      executionCount: null,
      outputs: [],
    })
    const { container } = render(
      <InteractiveNotebook notebook={notebook} adapter={stubAdapter()} />
    )
    const [layout] = Array.from(container.children) as HTMLElement[]
    const regions = Array.from(layout!.children)
    // TOC aside first, main content after it.
    expect(regions[0]!.tagName).toBe("ASIDE")

    runCell()
    await waitFor(() => expect(visualizeButtons()).toHaveLength(1))
    fireEvent.click(visualizeButtons()[0]!)
    const after = Array.from(layout!.children)
    // Panel aside is the last region (right column at lg / overlay below).
    const panelHost = after[after.length - 1] as HTMLElement
    expect(panelHost.tagName).toBe("ASIDE")
    expect(within(panelHost).getByLabelText("Execution visualization")).toBeDefined()
  })
})
