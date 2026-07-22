import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type {
  NotebookRecord,
  WorkerRequest,
  WorkerResponse,
} from "../../kernel/types"
import type { TraceFactory } from "../../visualize"
import { FIXTURE_TRACE } from "../../visualize"
import type { NotebookStore } from "../store"
import { NotebookEditor } from "./NotebookEditor"

// CodeMirror needs real layout APIs; a textarea keeps source editing testable.
vi.mock("./CodeCellEditor", () => ({
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

function record(language: string): NotebookRecord {
  return {
    notebook: {
      title: "QA",
      language,
      metadata: {},
      cells: [
        {
          id: "a",
          cellType: "code",
          source: "x = 1",
          executionCount: null,
          outputs: [],
        },
      ],
    },
    meta: {
      published: false,
      runtimeProfile: language === "python" ? "data-science" : "cpp",
      updatedAt: new Date().toISOString(),
    },
  }
}

function memoryStore(initial: NotebookRecord): NotebookStore {
  let current: NotebookRecord = initial
  return {
    load: async () => current,
    save: async (_slug, next) => {
      current = next
    },
    list: async () => [],
    remove: async () => {},
  }
}

/**
 * Speaks the real worker protocol so the editor drives the real
 * PyodideKernelAdapter. Pyodide itself cannot load in jsdom.
 */
class FakeKernelWorker {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null
  onerror: ((event: { message: string }) => void) | null = null
  private count = 0

  postMessage(request: WorkerRequest): void {
    queueMicrotask(() => {
      if (request.type === "init") {
        this.emit({ type: "ready" })
      } else if (request.type === "execute") {
        this.emit({ type: "status", status: "busy" })
        this.emit({
          type: "stream",
          execId: request.execId,
          name: "stdout",
          text: "ok\n",
        })
        this.emit({
          type: "done",
          execId: request.execId,
          executionCount: ++this.count,
        })
        this.emit({ type: "status", status: "idle" })
      }
    })
  }

  terminate(): void {}

  private emit(data: WorkerResponse): void {
    this.onmessage?.({ data } as MessageEvent<WorkerResponse>)
  }
}

function renderEditor(language: string, createTrace?: TraceFactory) {
  const initial = record(language)
  return render(
    <NotebookEditor
      slug="qa"
      store={memoryStore(initial)}
      initial={initial}
      createKernelWorker={() => new FakeKernelWorker() as unknown as Worker}
      createTrace={createTrace}
    />
  )
}

const visualizeButtons = () =>
  screen.queryAllByRole("button", { name: /Visualize execution/ })

describe("NotebookEditor visualization", () => {
  it("hides the action until the cell has run unchanged", async () => {
    renderEditor("python", async () => FIXTURE_TRACE)
    await screen.findByLabelText("Cell source")
    expect(visualizeButtons()).toHaveLength(0)
  })

  it("offers a disabled Coming soon action for non-traceable languages", async () => {
    renderEditor("cpp", async () => FIXTURE_TRACE)
    await screen.findByLabelText("Cell source")

    const button = visualizeButtons()[0] as HTMLButtonElement | undefined
    expect(button).toBeDefined()
    expect(button!.disabled).toBe(true)
    expect(button!.title).toContain("Coming soon")
  })

  it("opens the panel to the right of the cells after a successful run", async () => {
    renderEditor("python", async ({ source }) => ({
      ...FIXTURE_TRACE,
      steps: FIXTURE_TRACE.steps.map((step) => ({
        ...step,
        stdout: [`traced:${source}`],
      })),
    }))
    await screen.findByLabelText("Cell source")

    fireEvent.click(screen.getByRole("button", { name: "Run cell" }))
    await waitFor(() => expect(visualizeButtons()).toHaveLength(1))

    fireEvent.click(visualizeButtons()[0]!)
    const panel = await screen.findByLabelText("Execution visualization")
    expect(within(panel).getByLabelText("Source lines").textContent).toContain(
      "x = 1"
    )
    await waitFor(() => expect(panel.textContent).toContain("Bước 1 / 3"))

    // Cells column first, panel aside last.
    const row = panel.closest("aside")!.parentElement!
    expect(row.lastElementChild!.tagName).toBe("ASIDE")
    expect(row.firstElementChild!.tagName).not.toBe("ASIDE")

    fireEvent.click(screen.getByRole("button", { name: "Close visualization" }))
    expect(screen.queryByLabelText("Execution visualization")).toBeNull()
  })

  it("shows an engine failure with a working retry", async () => {
    const createTrace = vi
      .fn<TraceFactory>()
      .mockRejectedValueOnce(
        Object.assign(new Error("Trace worker crashed"), {
          name: "WorkerError",
        })
      )
      .mockResolvedValue(FIXTURE_TRACE)
    renderEditor("python", createTrace)
    await screen.findByLabelText("Cell source")

    fireEvent.click(screen.getByRole("button", { name: "Run cell" }))
    await waitFor(() => expect(visualizeButtons()).toHaveLength(1))
    fireEvent.click(visualizeButtons()[0]!)

    const panel = await screen.findByLabelText("Execution visualization")
    await waitFor(() =>
      expect(panel.textContent).toContain("Trace worker crashed")
    )
    expect(panel.textContent).not.toContain("not available yet")

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    await waitFor(() => expect(panel.textContent).toContain("Bước 1 / 3"))
  })

  it("closes the panel when the traced source is edited", async () => {
    renderEditor("python", async () => FIXTURE_TRACE)
    await screen.findByLabelText("Cell source")

    fireEvent.click(screen.getByRole("button", { name: "Run cell" }))
    await waitFor(() => expect(visualizeButtons()).toHaveLength(1))
    fireEvent.click(visualizeButtons()[0]!)
    await screen.findByLabelText("Execution visualization")

    fireEvent.change(screen.getByLabelText("Cell source"), {
      target: { value: "x = 2" },
    })

    await waitFor(() =>
      expect(screen.queryByLabelText("Execution visualization")).toBeNull()
    )
  })
})
