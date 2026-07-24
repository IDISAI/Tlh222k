"use client"

import type { NotebookCell } from "../../types"
import { CodeCell } from "./CodeCell"
import { MarkdownCell } from "./MarkdownCell"
import { OutputRenderer } from "./OutputRenderer"

export interface CellRendererProps {
  cell: NotebookCell
  /** Notebook language (nbformat); drives code-cell highlighting. */
  language?: string
}

/** Dispatches one notebook cell to its renderer. */
export function CellRenderer({ cell, language }: CellRendererProps) {
  switch (cell.cellType) {
    case "markdown":
      return <MarkdownCell source={cell.source} />
    case "code":
      return (
        <div className="space-y-2">
          <CodeCell
            source={cell.source}
            executionCount={cell.executionCount}
            language={language}
          />
          {cell.outputs.length > 0 && (
            // Align outputs with the code box (prompt gutter = w-16 + gap-3).
            <div className="space-y-2 pl-[4.75rem]">
              {cell.outputs.map((output, i) => (
                <OutputRenderer key={i} output={output} />
              ))}
            </div>
          )}
        </div>
      )
    case "raw":
      return (
        <pre className="overflow-x-auto rounded-md border border-dashed bg-muted/30 p-3 font-mono text-sm text-muted-foreground">
          {cell.source}
        </pre>
      )
  }
}
