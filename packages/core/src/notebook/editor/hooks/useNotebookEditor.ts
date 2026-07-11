"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { CellType, Notebook, NotebookCell } from "../../types"
import type { NotebookMeta, NotebookRecord } from "../../kernel/types"
import {
  changeCellType,
  deleteCell,
  duplicateCell,
  emptyNotebookRecord,
  insertCell,
  moveCell,
  updateSource,
} from "../editor.service"
import type { NotebookStore } from "../store"

export type SaveState = "idle" | "dirty" | "saving" | "saved"

export interface NotebookEditorApi {
  loading: boolean
  title: string
  cells: NotebookCell[]
  selectedId: string | null
  saveState: SaveState
  error: string | null
  setTitle: (title: string) => void
  select: (id: string | null) => void
  edit: (id: string, source: string) => void
  setType: (id: string, type: CellType) => void
  insert: (id: string | null, where: "above" | "below", type?: CellType) => void
  remove: (id: string) => void
  duplicate: (id: string) => void
  move: (id: string, direction: "up" | "down") => void
  /** The current notebook snapshot (for download / serialize). */
  snapshot: () => Notebook
  meta: NotebookMeta
}

const AUTOSAVE_MS = 1200

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Notebook persistence failed"
}

/**
 * Editor state for one notebook slug: loads from the store, tracks dirty state,
 * and autosaves (debounced) after edits. Execution is Phase 3 — this hook only
 * manages structure and content.
 */
export function useNotebookEditor(
  slug: string,
  store: NotebookStore,
  initial?: NotebookRecord | null
): NotebookEditorApi {
  const [record, setRecord] = useState<NotebookRecord>(
    () => initial ?? emptyNotebookRecord()
  )
  const [loading, setLoading] = useState(initial === undefined)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load persisted content on mount (falls back to a fresh notebook).
  useEffect(() => {
    if (initial !== undefined) return
    let cancelled = false
    void store.load(slug).then((loaded) => {
      if (cancelled) return
      setRecord(loaded ?? emptyNotebookRecord())
      setLoading(false)
    }).catch((cause: unknown) => {
      if (cancelled) return
      setError(errorMessage(cause))
      setRecord(emptyNotebookRecord())
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [slug, store, initial])

  // Debounced autosave whenever the notebook becomes dirty.
  const markDirty = useCallback(
    (next: NotebookRecord) => {
      setRecord(next)
      setError(null)
      setSaveState("dirty")
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        setSaveState("saving")
        void store.save(slug, next)
          .then(() => setSaveState("saved"))
          .catch((cause: unknown) => {
            setError(errorMessage(cause))
            setSaveState("dirty")
          })
      }, AUTOSAVE_MS)
    },
    [slug, store]
  )

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  const patchCells = useCallback(
    (cells: NotebookCell[]) =>
      markDirty({ ...record, notebook: { ...record.notebook, cells } }),
    [record, markDirty]
  )

  return {
    loading,
    title: record.notebook.title,
    cells: record.notebook.cells,
    selectedId,
    saveState,
    error,
    setTitle: (title) =>
      markDirty({ ...record, notebook: { ...record.notebook, title } }),
    select: setSelectedId,
    edit: (id, source) =>
      patchCells(updateSource(record.notebook.cells, id, source)),
    setType: (id, type) =>
      patchCells(changeCellType(record.notebook.cells, id, type)),
    insert: (id, where, type) => {
      const { cells, newId } = insertCell(record.notebook.cells, id, where, type)
      patchCells(cells)
      setSelectedId(newId)
    },
    remove: (id) => patchCells(deleteCell(record.notebook.cells, id)),
    duplicate: (id) => {
      const { cells, newId } = duplicateCell(record.notebook.cells, id)
      patchCells(cells)
      setSelectedId(newId)
    },
    move: (id, direction) =>
      patchCells(moveCell(record.notebook.cells, id, direction)),
    snapshot: () => record.notebook,
    meta: record.meta,
  }
}
