// Pure (React-free) cell mutations for the notebook editor. Every operation
// returns a NEW cell array so React state updates stay immutable and the hook
// can keep an undo history. Kept framework-agnostic so it is trivially testable.

import type { CellType, Notebook, NotebookCell } from "../types"
import type { NotebookMeta, NotebookRecord } from "../kernel/types"
import {
  isRuntimeProfile,
  languageSpec,
  type NotebookLanguage,
} from "../kernel/languages"
import {
  isStarterNote,
  isUntouchedSource,
  starterFor,
} from "../kernel/starters"

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
  return {
    id: newCellId(),
    cellType,
    source,
    executionCount: null,
    outputs: [],
  }
}

/**
 * A fresh notebook, seeded for `language`: the title, a line on how this kernel
 * runs code, and a first cell that prints something. Five of the seven kernels
 * are REPLs where the obvious `main`-shaped program runs and prints nothing, so
 * a blank cell is a worse starting point than a correct one-liner.
 */
export function emptyNotebook(
  title = "Untitled notebook",
  language: NotebookLanguage = "python"
): Notebook {
  const spec = languageSpec(language) ?? languageSpec("python")!
  const starter = starterFor(spec.language)
  return {
    title,
    language: spec.language,
    cells: [
      createCell("markdown", `# ${title}\n`),
      ...(starter ? [createCell("markdown", starter.note)] : []),
      createCell("code", starter?.code ?? ""),
    ],
    metadata: {
      kernelspec: {
        name: spec.kernelName,
        display_name: spec.displayName,
        language: spec.language,
      },
      language_info: { name: spec.language },
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

/**
 * A markdown cell holding nothing but one `# heading` — the notebook's visible
 * title, which is also what the reader sees on web and what feeds the TOC.
 */
const TITLE_CELL = /^\s*#\s+(.*?)\s*#*\s*$/

/**
 * Rewrite the notebook's leading title cell so the heading in the body always
 * reads the same as `notebook.title`. Without this the editor shows the title
 * twice — once in its header input, once as a markdown cell — and the two drift
 * apart the moment either is edited. Cells are returned untouched when the
 * notebook does not open with a title cell (nothing to keep in step).
 */
export function retitleCells(
  cells: NotebookCell[],
  title: string
): NotebookCell[] {
  const first = cells[0]
  if (!first || first.cellType !== "markdown") return cells
  if (!TITLE_CELL.test(first.source)) return cells
  const source = `# ${title}\n`
  if (first.source === source) return cells
  return [{ ...first, source }, ...cells.slice(1)]
}

/**
 * Re-seed a still-untouched notebook for a new language. Switching kernel on a
 * notebook the author has not written in should hand them that language's
 * starter, not leave C++ boilerplate in a Julia notebook — but a notebook with
 * real work in it must never be rewritten, so this returns the cells unchanged
 * unless every code cell is blank or is some language's starter.
 */
export function reseedForLanguage(
  cells: NotebookCell[],
  language: NotebookLanguage
): NotebookCell[] {
  const starter = starterFor(language)
  if (!starter) return cells
  const code = cells.filter((cell) => cell.cellType === "code")
  const untouched =
    code.length <= 1 &&
    code.every(
      (cell) => isUntouchedSource(cell.source) && cell.outputs.length === 0
    )
  if (!untouched) return cells

  return cells.map((cell) => {
    // A fresh id, not a rewritten one: the runtime keys per-cell output by id,
    // so reusing it would leave the previous language's result sitting under
    // code that can no longer produce it.
    if (cell.cellType === "code") return createCell("code", starter.code)
    if (isStarterNote(cell.source)) return { ...cell, source: starter.note }
    return cell
  })
}

/** The title a body heading implies, or null when the cells open without one. */
export function titleFromCells(cells: NotebookCell[]): string | null {
  const first = cells[0]
  if (!first || first.cellType !== "markdown") return null
  const match = TITLE_CELL.exec(first.source)
  return match?.[1]?.trim() || null
}

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

export function deleteCell(cells: NotebookCell[], id: string): NotebookCell[] {
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
