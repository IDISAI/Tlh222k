"use client"

import { useMemo } from "react"
import { cn } from "@workspace/ui/lib/utils"

import { tokenizePython } from "../../utils/highlight"

// Beyond these the regex tokenizer is skipped (main-thread freeze /
// catastrophic backtracking guard) and the cell renders as plain text.
const MAX_HIGHLIGHT_LINES = 2000
const MAX_HIGHLIGHT_CHARS = 50_000

/** Jupyter-classic-ish palette for the hand-rolled tokenizer. */
const TOKEN_CLASS: Record<string, string> = {
  kw: "font-semibold text-emerald-700 dark:text-emerald-400",
  str: "text-rose-700 dark:text-rose-400",
  com: "italic text-slate-500 dark:text-zinc-500",
  num: "text-teal-700 dark:text-teal-400",
  fn: "text-sky-700 dark:text-sky-400",
  op: "text-violet-700 dark:text-violet-500",
}

export interface CodeCellProps {
  source: string
  executionCount: number | null
  className?: string
}

/** Kaggle-style code cell: `In [n]:` prompt + syntax-highlighted source. */
export function CodeCell({ source, executionCount, className }: CodeCellProps) {
  const oversized =
    source.length > MAX_HIGHLIGHT_CHARS ||
    source.split("\n").length > MAX_HIGHLIGHT_LINES

  const tokens = useMemo(
    () => (oversized ? null : tokenizePython(source)),
    [oversized, source]
  )

  return (
    <div className={cn("flex gap-3", className)}>
      <div className="w-16 shrink-0 select-none pt-3 text-right font-mono text-xs text-blue-600 dark:text-blue-400">
        In&nbsp;[{executionCount ?? " "}]:
      </div>
      <pre className="min-w-0 flex-1 overflow-x-auto rounded-md border bg-muted/50 p-3 font-mono text-sm leading-6">
        {tokens ? (
          <code>
            {tokens.map((token, i) =>
              token.type && TOKEN_CLASS[token.type] ? (
                <span key={i} className={TOKEN_CLASS[token.type]}>
                  {token.text}
                </span>
              ) : (
                token.text
              )
            )}
          </code>
        ) : (
          <code>{source}</code>
        )}
      </pre>
    </div>
  )
}
