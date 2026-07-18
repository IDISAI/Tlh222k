// Pure (React-free) cell mutations for the notebook editor. Every operation
// returns a NEW cell array so React state updates stay immutable and the hook
// can keep an undo history. Kept framework-agnostic so it is trivially testable.

import type { CellType, Notebook, NotebookCell } from "../types"
import type { NotebookMeta, NotebookRecord } from "../kernel/types"
import { isRuntimeProfile } from "../kernel/languages"

let idCounter = 0

/** Stable-enough unique cell id (crypto in the browser, counter as fallback). */
export function newCellId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `cell-${crypto.randomUUID()}`
  }
  idCounter += 1
  return `cell-${Date.now()}-${idCounter}`
}

export function createCell(cellType: CellType, source = ""): NotebookCell {
  return { id: newCellId(), cellType, source, executionCount: null, outputs: [] }
}

/** A fresh, empty notebook (used when the editor opens an unknown slug). */
export function emptyNotebook(title = "Untitled notebook"): Notebook {
  return {
    title,
    language: "python",
    cells: [createCell("markdown", `# ${title}\n`), createCell("code")],
    metadata: {
      kernelspec: { name: "python3", display_name: "Python 3", language: "python" },
      language_info: { name: "python" },
      title,
    },
  }
}

export function createNotebookMeta(
  overrides: Partial<NotebookMeta> = {}
): NotebookMeta {
  const runtimeProfile = overrides.runtimeProfile
  return {
    published:
      typeof overrides.published === "boolean" ? overrides.published : false,
    runtimeProfile:
      typeof runtimeProfile === "string" && isRuntimeProfile(runtimeProfile)
        ? runtimeProfile
        : "data-science",
    updatedAt:
      typeof overrides.updatedAt === "string"
        ? overrides.updatedAt
        : new Date().toISOString(),
  }
}

export function emptyNotebookRecord(
  title = "Untitled notebook",
  meta: Partial<NotebookMeta> = {}
): NotebookRecord {
  return { notebook: emptyNotebook(title), meta: createNotebookMeta(meta) }
}

export { isRuntimeProfile }

const indexOf = (cells: NotebookCell[], id: string) =>
  cells.findIndex((c) => c.id === id)

export function updateSource(
  cells: NotebookCell[],
  id: string,
  source: string
): NotebookCell[] {
  return cells.map((c) => (c.id === id ? { ...c, source } : c))
}

export function changeCellType(
  cells: NotebookCell[],
  id: string,
  cellType: CellType
): NotebookCell[] {
  return cells.map((c) =>
    c.id === id
      ? // Switching type clears code-only fields so serialization stays valid.
        { ...c, cellType, executionCount: null, outputs: [] }
      : c
  )
}

/** Insert a new cell relative to `id` (or at the end when `id` is null). */
export function insertCell(
  cells: NotebookCell[],
  id: string | null,
  where: "above" | "below",
  cellType: CellType = "code"
): { cells: NotebookCell[]; newId: string } {
  const cell = createCell(cellType)
  if (id === null) return { cells: [...cells, cell], newId: cell.id }
  const i = indexOf(cells, id)
  const at = where === "above" ? i : i + 1
  const next = [...cells]
  next.splice(at, 0, cell)
  return { cells: next, newId: cell.id }
}

export function deleteCell(
  cells: NotebookCell[],
  id: string
): NotebookCell[] {
  // A notebook always keeps at least one cell.
  if (cells.length <= 1) return cells
  return cells.filter((c) => c.id !== id)
}

export function duplicateCell(
  cells: NotebookCell[],
  id: string
): { cells: NotebookCell[]; newId: string } {
  const i = indexOf(cells, id)
  if (i < 0) return { cells, newId: id }
  const copy: NotebookCell = { ...cells[i]!, id: newCellId() }
  const next = [...cells]
  next.splice(i + 1, 0, copy)
  return { cells: next, newId: copy.id }
}

export function moveCell(
  cells: NotebookCell[],
  id: string,
  direction: "up" | "down"
): NotebookCell[] {
  const i = indexOf(cells, id)
  if (i < 0) return cells
  const j = direction === "up" ? i - 1 : i + 1
  if (j < 0 || j >= cells.length) return cells
  const next = [...cells]
  ;[next[i], next[j]] = [next[j]!, next[i]!]
  return next
}
