import type {
  CellOutput,
  MimeBundle,
  Notebook,
  NotebookCell,
  RawCell,
  RawNotebook,
  RawOutput,
  TocEntry,
} from "./types"
import { NotebookParseError } from "./types"
import { createSlugger } from "./utils/slugify"
import { joinSource } from "./utils/nbformat"

/** Markdown ATX headings, used for both TOC and title derivation. */
const HEADING_PATTERN = /^(#{1,6})\s+(.+?)\s*#*\s*$/gm

/** Cells beyond this are rejected at parse time (regex-freeze protection). */
const MAX_CELL_SOURCE_CHARS = 3 * 1024 * 1024

export class NotebookService {
  /** Parse raw .ipynb JSON (string or object) into the normalized model. */
  parse(input: string | unknown): Notebook {
    let raw: unknown = input
    if (typeof input === "string") {
      try {
        raw = JSON.parse(input)
      } catch {
        throw new NotebookParseError("Notebook is not valid JSON")
      }
    }
    if (raw === null || typeof raw !== "object") {
      throw new NotebookParseError("Notebook must be a JSON object")
    }
    const nb = raw as Partial<RawNotebook>
    if (typeof nb.nbformat !== "number" || nb.nbformat !== 4) {
      throw new NotebookParseError(
        `Unsupported nbformat ${String(nb.nbformat)} — only nbformat 4 is supported`
      )
    }
    if (!Array.isArray(nb.cells)) {
      throw new NotebookParseError("Notebook has no cells array")
    }

    const cells = nb.cells.map((cell, i) => this.parseCell(cell, i))
    const metadata = nb.metadata ?? {}
    return {
      title: this.deriveTitle(metadata.title, cells),
      language:
        metadata.language_info?.name ??
        metadata.kernelspec?.language ??
        "python",
      cells,
      metadata,
    }
  }

  /** Serialize back to nbformat 4 JSON (used by the editor in later phases). */
  serialize(notebook: Notebook): RawNotebook {
    return {
      nbformat: 4,
      nbformat_minor: 5,
      // Editor edits notebook.title, not metadata.title — write it back so
      // the title survives the save/load round trip.
      metadata: { ...notebook.metadata, title: notebook.title },
      cells: notebook.cells.map((cell) => {
        const raw: RawCell = {
          id: cell.id,
          cell_type: cell.cellType,
          source: cell.source,
          metadata: {},
        }
        if (cell.cellType === "code") {
          raw.execution_count = cell.executionCount
          raw.outputs = cell.outputs.map(serializeOutput)
        }
        return raw
      }),
    }
  }

  /** TOC from markdown-cell headings, in document order. */
  extractToc(notebook: Notebook): TocEntry[] {
    const entries: TocEntry[] = []
    for (const cell of notebook.cells) {
      if (cell.cellType !== "markdown") continue
      // Per-cell slugger mirrors MarkdownCell's own ID computation so TOC
      // anchors always match the rendered heading ids.
      const slug = createSlugger()
      for (const match of cell.source.matchAll(HEADING_PATTERN)) {
        const text = stripInlineMarkdown(match[2]!)
        entries.push({
          level: match[1]!.length,
          text,
          slug: slug(text),
          cellId: cell.id,
        })
      }
    }
    return entries
  }

  private parseCell(raw: unknown, index: number): NotebookCell {
    if (raw === null || typeof raw !== "object") {
      throw new NotebookParseError(`Cell ${index} is not an object`)
    }
    const cell = raw as Partial<RawCell>
    if (
      cell.cell_type !== "code" &&
      cell.cell_type !== "markdown" &&
      cell.cell_type !== "raw"
    ) {
      throw new NotebookParseError(
        `Cell ${index} has unknown cell_type "${String(cell.cell_type)}"`
      )
    }
    const source = joinSource(cell.source)
    if (source.length > MAX_CELL_SOURCE_CHARS) {
      throw new NotebookParseError(
        `Cell ${index} exceeds the maximum supported size (${MAX_CELL_SOURCE_CHARS} chars)`
      )
    }
    return {
      id: cell.id ?? `cell-${index}`,
      cellType: cell.cell_type,
      source,
      executionCount:
        typeof cell.execution_count === "number" ? cell.execution_count : null,
      outputs: (cell.outputs ?? []).map(parseOutput),
    }
  }

  private deriveTitle(
    metadataTitle: unknown,
    cells: NotebookCell[]
  ): string {
    if (typeof metadataTitle === "string" && metadataTitle.trim()) {
      return metadataTitle.trim()
    }
    for (const cell of cells) {
      if (cell.cellType !== "markdown") continue
      const match = /^#\s+(.+?)\s*#*\s*$/m.exec(cell.source)
      if (match) return stripInlineMarkdown(match[1]!)
    }
    return "Untitled notebook"
  }
}

function parseOutput(raw: RawOutput): CellOutput {
  switch (raw.output_type) {
    case "stream":
      return {
        kind: "stream",
        name: raw.name === "stderr" ? "stderr" : "stdout",
        text: joinSource(raw.text),
      }
    case "execute_result":
      return {
        kind: "execute_result",
        executionCount:
          typeof raw.execution_count === "number" ? raw.execution_count : null,
        data: parseMimeBundle(raw.data),
      }
    case "display_data":
      return { kind: "display_data", data: parseMimeBundle(raw.data) }
    case "error":
      return {
        kind: "error",
        ename: raw.ename ?? "Error",
        evalue: raw.evalue ?? "",
        traceback: raw.traceback ?? [],
      }
    default:
      // Unknown output types degrade to empty stdout rather than crashing.
      return { kind: "stream", name: "stdout", text: "" }
  }
}

function parseMimeBundle(
  data: Record<string, string | string[] | unknown> | undefined
): MimeBundle {
  const bundle: MimeBundle = {}
  if (!data) return bundle
  const asText = (v: unknown) =>
    typeof v === "string" || Array.isArray(v)
      ? joinSource(v as string | string[])
      : undefined

  const html = asText(data["text/html"])
  if (html !== undefined) bundle.html = html

  for (const mime of ["image/png", "image/jpeg", "image/gif", "image/svg+xml"]) {
    const image = asText(data[mime])
    if (image !== undefined) {
      bundle.image = { mime, base64: image.replace(/\n/g, "") }
      break
    }
  }

  const text = asText(data["text/plain"])
  if (text !== undefined) bundle.text = text
  return bundle
}

function serializeOutput(output: CellOutput): RawOutput {
  switch (output.kind) {
    case "stream":
      return { output_type: "stream", name: output.name, text: output.text }
    case "execute_result":
      return {
        output_type: "execute_result",
        execution_count: output.executionCount,
        data: serializeMimeBundle(output.data),
        metadata: {},
      } as RawOutput
    case "display_data":
      return {
        output_type: "display_data",
        data: serializeMimeBundle(output.data),
        metadata: {},
      } as RawOutput
    case "error":
      return {
        output_type: "error",
        ename: output.ename,
        evalue: output.evalue,
        traceback: output.traceback,
      }
  }
}

function serializeMimeBundle(bundle: MimeBundle): Record<string, string> {
  const data: Record<string, string> = {}
  if (bundle.html !== undefined) data["text/html"] = bundle.html
  if (bundle.image) data[bundle.image.mime] = bundle.image.base64
  if (bundle.text !== undefined) data["text/plain"] = bundle.text
  return data
}

/** "practice **manipulating** `variables`" → plain text for TOC/title. */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .trim()
}
