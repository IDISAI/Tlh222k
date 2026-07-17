import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useNotebookEditor } from "./useNotebookEditor"
import type { NotebookStore } from "../store"

function storeWith(
  overrides: Partial<NotebookStore> = {}
): NotebookStore {
  return {
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
    remove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe("useNotebookEditor persistence errors", () => {
  it("exits loading and exposes a load failure", async () => {
    const store = storeWith({
      load: vi.fn().mockRejectedValue(new Error("load failed")),
    })
    const { result } = renderHook(() => useNotebookEditor("demo", store))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe("load failed")
  })

  it("keeps edits dirty and retryable when autosave fails", async () => {
    vi.useFakeTimers()
    const store = storeWith({
      save: vi.fn().mockRejectedValue(new Error("save failed")),
    })
    const { result } = renderHook(() => useNotebookEditor("demo", store, null))

    act(() => result.current.setTitle("Changed"))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })

    expect(result.current.saveState).toBe("dirty")
    expect(result.current.error).toBe("save failed")
  })
})
