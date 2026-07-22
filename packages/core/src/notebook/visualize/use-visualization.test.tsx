import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { FIXTURE_TRACE } from "./fixtures"
import type { TraceFactory, TraceLanguage } from "./types"
import {
  traceErrorResult,
  useTraceEngines,
  useVisualization,
} from "./use-visualization"

afterEach(cleanup)

interface Cell {
  source: string
  lastRunStatus: string
  lastExecutedSource?: string
  executionCount: number | null
}

const READY: Cell = {
  source: "x = 1",
  lastRunStatus: "success",
  lastExecutedSource: "x = 1",
  executionCount: 1,
}

/** Renders the hook's state as text so behavior is asserted, not internals. */
function Harness({
  language = "python",
  cells,
  createTrace,
}: {
  language?: string
  cells: Record<string, Cell>
  createTrace?: TraceFactory
}) {
  const visualization = useVisualization({ language, cells, createTrace })
  const active = visualization.active
  return (
    <div>
      <button type="button" onClick={() => visualization.open("a")}>
        open
      </button>
      <button type="button" onClick={visualization.retry}>
        retry
      </button>
      <button type="button" onClick={visualization.close}>
        close
      </button>
      <output data-testid="state">
        {active === null
          ? "closed"
          : active.loading
            ? "loading"
            : active.trace === null
              ? "no-engine"
              : (active.trace.error?.message ??
                `steps:${active.trace.steps.length}`)}
      </output>
    </div>
  )
}

const state = () => screen.getByTestId("state").textContent

describe("useVisualization", () => {
  it("refuses to trace a cell that does not pass the success/source gate", () => {
    const createTrace = vi.fn<TraceFactory>()
    render(
      <Harness
        cells={{ a: { ...READY, source: "x = 2" } }}
        createTrace={createTrace}
      />
    )

    fireEvent.click(screen.getByText("open"))

    expect(createTrace).not.toHaveBeenCalled()
    expect(state()).toBe("closed")
  })

  it("shows the engine's real failure and retries it on demand", async () => {
    const createTrace = vi
      .fn<TraceFactory>()
      .mockRejectedValueOnce(
        Object.assign(new Error("Trace timed out after 10s"), {
          name: "TimeoutError",
        })
      )
      .mockResolvedValue(FIXTURE_TRACE)
    render(<Harness cells={{ a: READY }} createTrace={createTrace} />)

    fireEvent.click(screen.getByText("open"))
    await waitFor(() => expect(state()).toBe("Trace timed out after 10s"))

    fireEvent.click(screen.getByText("retry"))
    await waitFor(() =>
      expect(state()).toBe(`steps:${FIXTURE_TRACE.steps.length}`)
    )
    expect(createTrace).toHaveBeenCalledTimes(2)
  })

  it("reports a missing engine instead of a failure", () => {
    render(<Harness cells={{ a: READY }} />)
    fireEvent.click(screen.getByText("open"))
    expect(state()).toBe("no-engine")
  })

  it("closes the open trace once its source stops matching the run", async () => {
    const createTrace = vi.fn<TraceFactory>().mockResolvedValue(FIXTURE_TRACE)
    const { rerender } = render(
      <Harness cells={{ a: READY }} createTrace={createTrace} />
    )

    fireEvent.click(screen.getByText("open"))
    await waitFor(() => expect(state()).not.toBe("loading"))

    rerender(
      <Harness
        cells={{ a: { ...READY, source: "x = 2" } }}
        createTrace={createTrace}
      />
    )
    expect(state()).toBe("closed")
  })

  it("closes the open trace when the cell starts running again", async () => {
    const createTrace = vi.fn<TraceFactory>().mockResolvedValue(FIXTURE_TRACE)
    const { rerender } = render(
      <Harness cells={{ a: READY }} createTrace={createTrace} />
    )
    fireEvent.click(screen.getByText("open"))
    await waitFor(() => expect(state()).not.toBe("loading"))

    rerender(
      <Harness
        cells={{ a: { ...READY, lastRunStatus: "running" } }}
        createTrace={createTrace}
      />
    )
    expect(state()).toBe("closed")
  })

  it("does not resurrect a trace after an identical source is rerun", async () => {
    const createTrace = vi.fn<TraceFactory>().mockResolvedValue(FIXTURE_TRACE)
    const { rerender } = render(
      <Harness cells={{ a: READY }} createTrace={createTrace} />
    )
    fireEvent.click(screen.getByText("open"))
    await waitFor(() => expect(state()).not.toBe("loading"))

    // Same source, new run: the displayed trace describes the previous run.
    rerender(
      <Harness
        cells={{ a: { ...READY, executionCount: 2 } }}
        createTrace={createTrace}
      />
    )
    expect(state()).toBe("closed")
  })

  it("drops a result that arrives after the host unmounted", async () => {
    let settle: ((value: typeof FIXTURE_TRACE) => void) | undefined
    const createTrace = vi
      .fn<TraceFactory>()
      .mockImplementation(() => new Promise((resolve) => (settle = resolve)))
    const errors: unknown[] = []
    const original = console.error
    console.error = (...args: unknown[]) => errors.push(args)
    try {
      const { unmount } = render(
        <Harness cells={{ a: READY }} createTrace={createTrace} />
      )
      fireEvent.click(screen.getByText("open"))
      unmount()
      settle!(FIXTURE_TRACE)
      await Promise.resolve()
      await Promise.resolve()
    } finally {
      console.error = original
    }

    expect(errors).toEqual([])
  })

  it("drops a late result from a superseded request", async () => {
    let settle: ((value: typeof FIXTURE_TRACE) => void) | undefined
    const createTrace = vi
      .fn<TraceFactory>()
      .mockImplementationOnce(
        () => new Promise((resolve) => (settle = resolve))
      )
      .mockResolvedValue(FIXTURE_TRACE)
    render(<Harness cells={{ a: READY }} createTrace={createTrace} />)

    fireEvent.click(screen.getByText("open"))
    fireEvent.click(screen.getByText("close"))
    settle!(FIXTURE_TRACE)

    await Promise.resolve()
    expect(state()).toBe("closed")
  })
})

describe("traceErrorResult", () => {
  it("keeps the engine's name, message, and line", () => {
    const error = Object.assign(new Error("boom"), {
      name: "PythonError",
      line: 4,
    })
    expect(traceErrorResult("python", error)).toEqual({
      language: "python",
      steps: [],
      truncated: false,
      error: { name: "PythonError", message: "boom", line: 4 },
    })
  })

  it("falls back to a usable message for a non-Error rejection", () => {
    expect(traceErrorResult("javascript", "worker gone")).toEqual({
      language: "javascript",
      steps: [],
      truncated: false,
      error: { name: "TraceError", message: "worker gone" },
    })
  })
})

// ── useTraceEngines ─────────────────────────────────────────────────────────

class FakeWorker {
  static created: FakeWorker[] = []
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  onerror: ((event: { message: string }) => void) | null = null
  readonly posted: unknown[] = []
  terminated = 0

  constructor(readonly language: string) {
    FakeWorker.created.push(this)
  }

  postMessage(data: { type: string; id: string }): void {
    this.posted.push(data)
    queueMicrotask(() =>
      this.onmessage?.({
        data: {
          type: "trace-result",
          id: data.id,
          result: { ...FIXTURE_TRACE, language: this.language },
        },
      } as MessageEvent<unknown>)
    )
  }

  terminate(): void {
    this.terminated += 1
  }
}

function EngineHarness({ languages }: { languages: TraceLanguage[] }) {
  const createTrace = useTraceEngines(
    (language) => new FakeWorker(language) as unknown as Worker
  )
  return (
    <div>
      {languages.map((language) => (
        <button
          key={language}
          type="button"
          onClick={() => void createTrace({ language, source: "x = 1" })}
        >
          {`trace-${language}`}
        </button>
      ))}
    </div>
  )
}

describe("useTraceEngines", () => {
  it("creates no worker until the first request, then reuses it", async () => {
    FakeWorker.created = []
    render(<EngineHarness languages={["python"]} />)
    expect(FakeWorker.created).toHaveLength(0)

    fireEvent.click(screen.getByText("trace-python"))
    fireEvent.click(screen.getByText("trace-python"))
    await waitFor(() => expect(FakeWorker.created[0]!.posted).toHaveLength(2))
    expect(FakeWorker.created).toHaveLength(1)
  })

  it("keeps one engine per language", async () => {
    FakeWorker.created = []
    render(<EngineHarness languages={["python", "javascript"]} />)

    fireEvent.click(screen.getByText("trace-python"))
    fireEvent.click(screen.getByText("trace-javascript"))
    await waitFor(() => expect(FakeWorker.created).toHaveLength(2))
    expect(FakeWorker.created.map((worker) => worker.language)).toEqual([
      "python",
      "javascript",
    ])
  })

  it("terminates every created worker once on unmount", async () => {
    FakeWorker.created = []
    const { unmount } = render(
      <EngineHarness languages={["python", "javascript"]} />
    )
    fireEvent.click(screen.getByText("trace-python"))
    fireEvent.click(screen.getByText("trace-javascript"))
    await waitFor(() => expect(FakeWorker.created).toHaveLength(2))

    unmount()

    expect(FakeWorker.created.map((worker) => worker.terminated)).toEqual([
      1, 1,
    ])
  })
})
