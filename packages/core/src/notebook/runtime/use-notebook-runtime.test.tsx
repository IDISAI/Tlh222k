import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { ExecuteCallbacks, ExecuteResult, KernelAdapter } from "../kernel"
import type { Notebook } from "../types"
import { useNotebookRuntime } from "./use-notebook-runtime"

const notebook: Notebook = {
  title: "t",
  language: "python",
  metadata: {},
  cells: [
    {
      id: "c1",
      cellType: "code",
      source: "print(1)",
      executionCount: null,
      outputs: [],
    },
  ],
}

/** Adapter whose execute resolves/behaves per the supplied script. */
function stubAdapter(
  execute: (code: string, callbacks?: ExecuteCallbacks) => Promise<ExecuteResult>
): KernelAdapter {
  return {
    status: "idle",
    subscribeStatus: () => () => {},
    start: async () => {},
    execute,
    interrupt: async () => {},
    restart: async () => {},
    dispose: () => {},
  }
}

describe("useNotebookRuntime run outcome", () => {
  it("starts with lastRunStatus never and no executed source", () => {
    const { result } = renderHook(() => useNotebookRuntime(notebook, null))
    expect(result.current.cells.c1).toMatchObject({ lastRunStatus: "never" })
    expect(result.current.cells.c1!.lastExecutedSource).toBeUndefined()
  })

  it("is running synchronously and success after clean completion", async () => {
    let resolve!: (r: ExecuteResult) => void
    const adapter = stubAdapter(() => new Promise((r) => { resolve = r }))
    const { result } = renderHook(() => useNotebookRuntime(notebook, adapter))

    let pending!: Promise<void>
    act(() => { pending = result.current.runCell("c1") })
    expect(result.current.cells.c1).toMatchObject({
      lastRunStatus: "running",
      lastExecutedSource: "print(1)",
    })

    await act(async () => {
      resolve({ executionCount: 1 })
      await pending
    })
    expect(result.current.cells.c1).toMatchObject({
      lastRunStatus: "success",
      executionCount: 1,
      running: false,
    })
  })

  it("finishes as error when an error output streamed, even though execute resolves", async () => {
    const adapter = stubAdapter(async (_code, callbacks) => {
      callbacks?.onOutput?.({
        kind: "error",
        ename: "ZeroDivisionError",
        evalue: "division by zero",
        traceback: [],
      })
      return { executionCount: 2 }
    })
    const { result } = renderHook(() => useNotebookRuntime(notebook, adapter))
    await act(async () => { await result.current.runCell("c1") })
    expect(result.current.cells.c1).toMatchObject({
      lastRunStatus: "error",
      executionCount: 2,
      running: false,
    })
  })

  it("finishes as error when execute rejects", async () => {
    const adapter = stubAdapter(async () => {
      throw new Error("kernel died")
    })
    const { result } = renderHook(() => useNotebookRuntime(notebook, adapter))
    await act(async () => {
      await expect(result.current.runCell("c1")).rejects.toThrow("kernel died")
    })
    expect(result.current.cells.c1).toMatchObject({ lastRunStatus: "error", running: false })
    expect(result.current.error).toBe("kernel died")
  })

  it("keeps success status across source edits; executed source stays the ran snapshot", async () => {
    const adapter = stubAdapter(async () => ({ executionCount: 1 }))
    const { result } = renderHook(() => useNotebookRuntime(notebook, adapter))
    await act(async () => { await result.current.runCell("c1") })
    act(() => result.current.updateSource("c1", "print(2)"))
    await waitFor(() =>
      expect(result.current.cells.c1).toMatchObject({
        source: "print(2)",
        lastRunStatus: "success",
        lastExecutedSource: "print(1)",
      })
    )
  })

  it("ignores a stale completion from an older run", async () => {
    const resolvers: Array<(r: ExecuteResult) => void> = []
    const adapter = stubAdapter(() => new Promise((r) => resolvers.push(r)))
    const { result } = renderHook(() => useNotebookRuntime(notebook, adapter))

    let first!: Promise<void>
    let second!: Promise<void>
    act(() => { first = result.current.runCell("c1") })
    act(() => { second = result.current.runCell("c1") })

    // Older run resolving must not overwrite the newer run's outcome.
    await act(async () => {
      resolvers[0]!({ executionCount: 1 })
      await first
    })
    expect(result.current.cells.c1!.lastRunStatus).toBe("running")

    await act(async () => {
      resolvers[1]!({ executionCount: 2 })
      await second
    })
    expect(result.current.cells.c1!.lastRunStatus).toBe("success")
  })

  it("restart resets outcomes to never", async () => {
    const adapter = stubAdapter(async () => ({ executionCount: 1 }))
    const { result } = renderHook(() => useNotebookRuntime(notebook, adapter))
    await act(async () => { await result.current.runCell("c1") })
    await act(async () => { await result.current.restart() })
    expect(result.current.cells.c1).toMatchObject({ lastRunStatus: "never" })
  })
})
