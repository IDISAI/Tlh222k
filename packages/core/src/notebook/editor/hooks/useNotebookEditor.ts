"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { CellType, Notebook, NotebookCell } from "../../types"
import type { NotebookMeta, NotebookRecord } from "../../kernel/types"
import { languageSpec } from "../../kernel/languages"
import {
  changeCellType,
  deleteCell,
  duplicateCell,
  emptyNotebookRecord,
  insertCell,
  moveCell,
  retitleCells,
  titleFromCells,
  updateSource,
} from "../editor.service"
import type { NotebookStore } from "../store"

export type SaveState = "idle" | "dirty" | "saving" | "saved"

export interface NotebookEditorApi {
  loading: boolean
  title: string
  /** Notebook language (nbformat), e.g. "python", "javascript". */
  language: string
  cells: NotebookCell[]
  selectedId: string | null
  saveState: SaveState
  error: string | null
  setTitle: (title: string) => void
  /** Switch the notebook language: rewrites kernelspec + runtime profile. */
  setLanguage: (language: string) => void
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
  /** Publish/unpublish for the public web viewer (/learn). */
  setPublished: (published: boolean) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

/** Consecutive source edits of the same cell coalesce into one history entry. */
const HISTORY_LIMIT = 100

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
  initial?: NotebookRecord | null,
  /** Title for a brand-new slug; the fresh notebook is persisted immediately. */
  defaultTitle?: string
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
    void store
      .load(slug)
      .then((loaded) => {
        if (cancelled) return
        if (loaded) {
          setRecord(loaded)
        } else {
          // New slug: seed with the create-form title and persist right away so
          // the notebook shows up in the index before the first edit.
          const fresh = emptyNotebookRecord(defaultTitle)
          setRecord(fresh)
          void store.save(slug, fresh).catch(() => undefined)
        }
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(errorMessage(cause))
        // Still the caller's title: a store that is down says nothing about what
        // this notebook is called, and "Untitled notebook" would be a worse guess.
        setRecord(emptyNotebookRecord(defaultTitle))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug, store, initial, defaultTitle])

  // Undo/redo history. Kept in refs (no re-render per keystroke); the
  // canUndo/canRedo booleans re-render via this counter.
  const pastRef = useRef<NotebookRecord[]>([])
  const futureRef = useRef<NotebookRecord[]>([])
  const lastEditKeyRef = useRef<string | null>(null)
  const [historyVersion, setHistoryVersion] = useState(0)

  // Debounced autosave for any record change (edits, undo, redo).
  const scheduleSave = useCallback(
    (next: NotebookRecord) => {
      setRecord(next)
      setError(null)
      setSaveState("dirty")
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        setSaveState("saving")
        void store
          .save(slug, next)
          .then(() => setSaveState("saved"))
          .catch((cause: unknown) => {
            setError(errorMessage(cause))
            setSaveState("dirty")
          })
      }, AUTOSAVE_MS)
    },
    [slug, store]
  )

  /**
   * Record a change. `editKey` (e.g. `edit:<cellId>`) coalesces consecutive
   * keystrokes in one cell into a single undo step; structural changes pass
   * no key and always get their own step.
   */
  const markDirty = useCallback(
    (next: NotebookRecord, editKey?: string) => {
      setRecord((current) => {
        if (!editKey || editKey !== lastEditKeyRef.current) {
          pastRef.current.push(current)
          if (pastRef.current.length > HISTORY_LIMIT) pastRef.current.shift()
        }
        return current
      })
      lastEditKeyRef.current = editKey ?? null
      futureRef.current = []
      setHistoryVersion((v) => v + 1)
      scheduleSave(next)
    },
    [scheduleSave]
  )

  const undo = useCallback(() => {
    const previous = pastRef.current.pop()
    if (!previous) return
    setRecord((current) => {
      futureRef.current.push(current)
      return current
    })
    lastEditKeyRef.current = null
    setHistoryVersion((v) => v + 1)
    scheduleSave(previous)
  }, [scheduleSave])

  const redo = useCallback(() => {
    const next = futureRef.current.pop()
    if (!next) return
    setRecord((current) => {
      pastRef.current.push(current)
      return current
    })
    lastEditKeyRef.current = null
    setHistoryVersion((v) => v + 1)
    scheduleSave(next)
  }, [scheduleSave])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  const patchCells = useCallback(
    (cells: NotebookCell[], editKey?: string) => {
      // The leading heading IS the title (that is what the web viewer renders),
      // so editing it renames the notebook rather than leaving the header input
      // showing a different name.
      const title = titleFromCells(cells) ?? record.notebook.title
      markDirty(
        {
          ...record,
          notebook: {
            ...record.notebook,
            cells,
            title,
            metadata: { ...record.notebook.metadata, title },
          },
        },
        editKey
      )
    },
    [record, markDirty]
  )

  return {
    loading,
    title: record.notebook.title,
    language: record.notebook.language,
    cells: record.notebook.cells,
    selectedId,
    saveState,
    error,
    setTitle: (title) =>
      markDirty(
        {
          ...record,
          notebook: {
            ...record.notebook,
            title,
            cells: retitleCells(record.notebook.cells, title),
            // Keep nbformat metadata in step too, so no layer of the notebook
            // is left holding a stale copy of the name.
            metadata: { ...record.notebook.metadata, title },
          },
        },
        "edit:title"
      ),
    setLanguage: (language) => {
      const spec = languageSpec(language)
      if (!spec) return
      markDirty({
        notebook: {
          ...record.notebook,
          language: spec.language,
          metadata: {
            ...record.notebook.metadata,
            kernelspec: {
              name: spec.kernelName,
              display_name: spec.displayName,
              language: spec.language,
            },
            language_info: { name: spec.language },
          },
        },
        meta: {
          ...record.meta,
          runtimeProfile:
            spec.language === "python"
              ? record.meta.runtimeProfile === "ml-cpu"
                ? "ml-cpu"
                : "data-science"
              : spec.profile,
        },
      })
    },
    select: setSelectedId,
    edit: (id, source) =>
      patchCells(updateSource(record.notebook.cells, id, source), `edit:${id}`),
    setType: (id, type) =>
      patchCells(changeCellType(record.notebook.cells, id, type)),
    insert: (id, where, type) => {
      const { cells, newId } = insertCell(
        record.notebook.cells,
        id,
        where,
        type
      )
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
    setPublished: (published) =>
      markDirty({ ...record, meta: { ...record.meta, published } }),
    undo,
    redo,
    // historyVersion ties these to the render cycle (refs alone don't).
    canUndo: historyVersion >= 0 && pastRef.current.length > 0,
    canRedo: historyVersion >= 0 && futureRef.current.length > 0,
  }
}
