import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useNotebookEditor } from "./useNotebookEditor"
import type { NotebookStore } from "../store"

function storeWith(overrides: Partial<NotebookStore> = {}): NotebookStore {
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

describe("useNotebookEditor language metadata", () => {
  it("rewrites kernelspec, language_info, and runtime profile", () => {
    const { result } = renderHook(() =>
      useNotebookEditor("demo", storeWith(), null)
    )

    act(() => result.current.setLanguage("rust"))

    expect(result.current.language).toBe("rust")
    expect(result.current.snapshot().metadata).toMatchObject({
      kernelspec: {
        name: "rust",
        display_name: "Rust (evcxr)",
        language: "rust",
      },
      language_info: { name: "rust" },
    })
    expect(result.current.meta.runtimeProfile).toBe("rust")
  })

  it("ignores unsupported language values", () => {
    const { result } = renderHook(() =>
      useNotebookEditor("demo", storeWith(), null)
    )
    const before = result.current.snapshot()

    act(() => result.current.setLanguage("brainfuck"))

    expect(result.current.snapshot()).toEqual(before)
    expect(result.current.saveState).toBe("idle")
  })
})

describe("useNotebookEditor title", () => {
  it("renames the heading the reader sees, not just the header input", () => {
    const { result } = renderHook(() =>
      useNotebookEditor("demo", storeWith(), null)
    )

    act(() => result.current.setTitle("Vòng lặp for"))

    expect(result.current.title).toBe("Vòng lặp for")
    expect(result.current.cells[0]?.source).toBe("# Vòng lặp for\n")
  })

  it("renames the notebook when the author edits the heading instead", () => {
    const { result } = renderHook(() =>
      useNotebookEditor("demo", storeWith(), null)
    )
    const headingId = result.current.cells[0]!.id

    act(() => result.current.edit(headingId, "# Biến và kiểu dữ liệu\n"))

    expect(result.current.title).toBe("Biến và kiểu dữ liệu")
  })

  it("leaves prose alone: only a leading heading cell is the title", () => {
    const { result } = renderHook(() =>
      useNotebookEditor("demo", storeWith(), null)
    )
    const headingId = result.current.cells[0]!.id

    act(() => result.current.edit(headingId, "Chỉ là một đoạn văn.\n"))
    act(() => result.current.setTitle("Đặt tên mới"))

    // The cell stopped being a title cell, so retitling must not clobber it.
    expect(result.current.title).toBe("Đặt tên mới")
    expect(result.current.cells[0]?.source).toBe("Chỉ là một đoạn văn.\n")
  })

  it("survives the save/load round trip through metadata", () => {
    const { result } = renderHook(() =>
      useNotebookEditor("demo", storeWith(), null)
    )

    act(() => result.current.setTitle("Đệ quy"))

    expect(result.current.snapshot().metadata).toMatchObject({
      title: "Đệ quy",
    })
  })
})
