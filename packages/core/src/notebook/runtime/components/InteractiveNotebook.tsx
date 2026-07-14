"use client"

import { useMemo } from "react"
import { Play, RotateCcw, Square } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

import type { KernelAdapter } from "../../kernel"
import type { Notebook, TocEntry } from "../../types"
import { NotebookService } from "../../notebook.service"
import { MarkdownCell } from "../../viewer/components/MarkdownCell"
import { StartExerciseCard } from "../../viewer/components/StartExerciseCard"
import { TableOfContents } from "../../viewer/components/TableOfContents"
import { useActiveHeading } from "../../viewer/hooks/useActiveHeading"
import { useNotebookRuntime } from "../use-notebook-runtime"
import { InteractiveCodeCell } from "./InteractiveCodeCell"

const service = new NotebookService()

export function InteractiveNotebook({
  notebook,
  adapter,
  signedIn = true,
  onSignIn,
  onStartExercise,
  exerciseTitle,
}: {
  notebook: Notebook
  adapter: KernelAdapter | null
  signedIn?: boolean
  onSignIn?: () => void
  /** Fires when user clicks "Start Exercise" in the floating card. */
  onStartExercise?: () => void
  /** Title of the companion exercise; triggers the floating card when set. */
  exerciseTitle?: string
}) {
  const runtime = useNotebookRuntime(notebook, adapter)
  const busy = runtime.status === "busy"

  const toc = useMemo(() => service.extractToc(notebook), [notebook])
  const slugs = useMemo(() => toc.map((e) => e.slug), [toc])
  const activeSlug = useActiveHeading(slugs)
  const headingsByCell = useMemo(() => {
    const map = new Map<string, TocEntry[]>()
    for (const entry of toc) {
      const list = map.get(entry.cellId)
      if (list) list.push(entry)
      else map.set(entry.cellId, [entry])
    }
    return map
  }, [toc])

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-10 px-4 py-6">
      {/* Main content */}
      <div className="min-w-0 flex-1">
        {/* Kernel bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2">
          <span className="text-sm text-muted-foreground">
            Kernel: {runtime.status}
          </span>
          {!signedIn ? (
            <Button type="button" size="sm" onClick={onSignIn}>
              Sign in to run
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void runtime.runAll()}
              >
                <Play className="size-3.5" /> Run all
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!busy}
                onClick={() => void runtime.interrupt()}
              >
                <Square className="size-3.5" /> Interrupt
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void runtime.restart()}
              >
                <RotateCcw className="size-3.5" /> Restart
              </Button>
            </div>
          )}
        </div>

        {runtime.error && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {runtime.error}
          </p>
        )}

        {/* Cells — code cells are interactive; markdown cells carry TOC anchors */}
        <div className="space-y-8">
          {notebook.cells.map((cell) => {
            if (cell.cellType === "code") {
              return (
                <InteractiveCodeCell
                  key={cell.id}
                  cell={runtime.cells[cell.id]!}
                  disabled={!signedIn || busy}
                  onChange={(source) => runtime.updateSource(cell.id, source)}
                  onRun={() => void runtime.runCell(cell.id)}
                />
              )
            }
            if (cell.cellType === "markdown") {
              return (
                <MarkdownCell
                  key={cell.id}
                  source={cell.source}
                  headings={headingsByCell.get(cell.id)}
                />
              )
            }
            return (
              <pre
                key={cell.id}
                className="whitespace-pre-wrap rounded-lg border p-4 text-sm"
              >
                {cell.source}
              </pre>
            )
          })}
        </div>
      </div>

      {/* TOC sidebar — scroll-spy, sticky, hidden on small screens */}
      {toc.length > 0 && (
        <aside className="sticky top-24 hidden max-h-[calc(100svh-8rem)] w-56 shrink-0 self-start overflow-y-auto lg:block">
          <TableOfContents entries={toc} activeSlug={activeSlug} />
        </aside>
      )}

      {/* "Your turn" floating card at bottom-right */}
      {onStartExercise && exerciseTitle && (
        <StartExerciseCard
          exerciseTitle={exerciseTitle}
          onStart={onStartExercise}
        />
      )}
    </div>
  )
}
