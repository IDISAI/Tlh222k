// nbformat v4 (https://nbformat.readthedocs.io/en/latest/format_description.html)
// modeled loosely: raw JSON may use `string | string[]` for sources/text — the
// service normalizes everything to plain strings before the UI sees it.

export type CellType = "code" | "markdown" | "raw"

/** Raw .ipynb JSON shapes (input of the parser). */
export interface RawNotebook {
  nbformat: number
  nbformat_minor: number
  metadata?: NotebookMetadata
  cells: RawCell[]
}

export interface RawCell {
  id?: string
  cell_type: CellType
  source: string | string[]
  metadata?: Record<string, unknown>
  execution_count?: number | null
  outputs?: RawOutput[]
}

export interface RawOutput {
  output_type: "stream" | "execute_result" | "display_data" | "error"
  // stream
  name?: "stdout" | "stderr"
  text?: string | string[]
  // execute_result / display_data
  data?: Record<string, string | string[] | unknown>
  execution_count?: number | null
  // error
  ename?: string
  evalue?: string
  traceback?: string[]
}

export interface NotebookMetadata {
  kernelspec?: { name?: string; display_name?: string; language?: string }
  language_info?: { name?: string; version?: string }
  title?: string
  [key: string]: unknown
}

// ── Normalized shapes (output of the parser, consumed by the UI) ────────────

export interface Notebook {
  /** Title from metadata, or derived from the first markdown H1, or fallback. */
  title: string
  language: string
  cells: NotebookCell[]
  metadata: NotebookMetadata
}

export interface NotebookCell {
  id: string
  cellType: CellType
  /** Source joined to a single string. */
  source: string
  /** Only meaningful for code cells; null = never executed. */
  executionCount: number | null
  outputs: CellOutput[]
}

export type CellOutput =
  | StreamOutput
  | ExecuteResultOutput
  | DisplayDataOutput
  | ErrorOutput

export interface StreamOutput {
  kind: "stream"
  name: "stdout" | "stderr"
  text: string
}

/** Mime bundle reduced to the representations the viewer can render. */
export interface MimeBundle {
  html?: string
  /** base64 payload keyed by its mime type, e.g. image/png. */
  image?: { mime: string; base64: string }
  text?: string
}

export interface ExecuteResultOutput {
  kind: "execute_result"
  executionCount: number | null
  data: MimeBundle
}

export interface DisplayDataOutput {
  kind: "display_data"
  data: MimeBundle
}

export interface ErrorOutput {
  kind: "error"
  ename: string
  evalue: string
  /** Traceback lines, ANSI escape codes preserved (parsed at render time). */
  traceback: string[]
}

// ── Table of contents ────────────────────────────────────────────────────────

export interface TocEntry {
  /** Heading level as authored (1–6); the viewer renders 2–3 as the TOC. */
  level: number
  text: string
  /** Anchor id, unique within the notebook. */
  slug: string
  /** Id of the markdown cell the heading lives in (anchor assignment). */
  cellId: string
}

// ── Parse failure ────────────────────────────────────────────────────────────

export class NotebookParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NotebookParseError"
  }
}
