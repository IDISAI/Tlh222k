"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import type { KernelAdapter, KernelStatus } from "../kernel"
import type { CellOutput, Notebook } from "../types"

export interface RuntimeCellState {
  source: string
  outputs: CellOutput[]
  executionCount: number | null
  running: boolean
}

export function useNotebookRuntime(notebook: Notebook, adapter: KernelAdapter | null) {
  const [cells, setCells] = useState<Record<string, RuntimeCellState>>(() => initialCells(notebook))
  const [status, setStatus] = useState<KernelStatus>(adapter?.status ?? "uninitialized")
  const [error, setError] = useState<string | null>(null)

  // Merge instead of reset: the editor re-snapshots on every keystroke, and a
  // full reset would wipe outputs of already-executed cells.
  useEffect(() => {
    setCells((current) =>
      Object.fromEntries(
        notebook.cells.map((cell) => [
          cell.id,
          current[cell.id]
            ? { ...current[cell.id]!, source: cell.source }
            : {
                source: cell.source,
                outputs: cell.outputs,
                executionCount: cell.executionCount,
                running: false,
              },
        ])
      )
    )
  }, [notebook])
  useEffect(() => {
    setStatus(adapter?.status ?? "uninitialized")
    return adapter?.subscribeStatus(setStatus)
  }, [adapter])
  useEffect(() => () => adapter?.dispose(), [adapter])

  const updateSource = useCallback((id: string, source: string) => {
    setCells((current) => ({ ...current, [id]: { ...current[id]!, source } }))
  }, [])

  const runCell = useCallback(async (id: string) => {
    if (!adapter) throw new Error("Sign in to run this notebook")
    const source = cells[id]?.source
    if (source === undefined) return
    setError(null)
    setCells((current) => ({ ...current, [id]: { ...current[id]!, outputs: [], running: true } }))
    try {
      const result = await adapter.execute(source, {
        onStream: (name, text) => setCells((current) => ({
          ...current,
          [id]: { ...current[id]!, outputs: [...current[id]!.outputs, { kind: "stream", name, text }] },
        })),
        onOutput: (output) => setCells((current) => ({
          ...current,
          [id]: { ...current[id]!, outputs: [...current[id]!.outputs, output] },
        })),
      })
      setCells((current) => ({
        ...current,
        [id]: { ...current[id]!, executionCount: result.executionCount, running: false },
      }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Execution failed")
      setCells((current) => ({ ...current, [id]: { ...current[id]!, running: false } }))
      throw cause
    }
  }, [adapter, cells])

  const codeCellIds = useMemo(
    () => notebook.cells.filter((cell) => cell.cellType === "code").map((cell) => cell.id),
    [notebook]
  )
  const runAll = useCallback(async () => {
    for (const id of codeCellIds) await runCell(id)
  }, [codeCellIds, runCell])
  const interrupt = useCallback(async () => adapter?.interrupt(), [adapter])
  const restart = useCallback(async () => {
    await adapter?.restart()
    setCells(initialCells(notebook))
    setError(null)
  }, [adapter, notebook])

  return { cells, status, error, updateSource, runCell, runAll, interrupt, restart }
}

function initialCells(notebook: Notebook): Record<string, RuntimeCellState> {
  return Object.fromEntries(notebook.cells.map((cell) => [cell.id, {
    source: cell.source,
    outputs: cell.outputs,
    executionCount: cell.executionCount,
    running: false,
  }]))
}
