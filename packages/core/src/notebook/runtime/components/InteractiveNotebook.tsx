"use client"

import { useMemo } from "react"
import { Play, RotateCcw, Square } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import type { KernelAdapter } from "../../kernel"
import type { Notebook } from "../../types"
import { NotebookService } from "../../notebook.service"
import { MarkdownCell } from "../../viewer/components/MarkdownCell"
import { StartExerciseCard } from "../../viewer/components/StartExerciseCard"
import { TableOfContents } from "../../viewer/components/TableOfContents"
import { useActiveHeading } from "../../viewer/hooks/useActiveHeading"
import {
  useVisualization,
  visualizeAvailability,
  VisualizePanel,
  type TraceFactory,
} from "../../visualize"
import { useNotebookRuntime } from "../use-notebook-runtime"
import { InteractiveCodeCell } from "./InteractiveCodeCell"

const service = new NotebookService()

export function InteractiveNotebook({
  notebook,
  adapter,
  signedIn = true,
  onSignIn,
  runUnavailableReason,
  onStartExercise,
  exerciseTitle,
  createTrace,
}: {
  notebook: Notebook
  adapter: KernelAdapter | null
  signedIn?: boolean
  onSignIn?: () => void
  /** When set, execution is unavailable (e.g. language needs the kernel server); shown instead of the sign-in button. */
  runUnavailableReason?: string
  /** Fires when user clicks "Start Exercise" in the floating card. */
  onStartExercise?: () => void
  /** Title of the companion exercise; triggers the floating card when set. */
  exerciseTitle?: string
  /**
   * Trace engine seam. Absent (production until C3/C4), the panel opens with
   * an "engine not available yet" notice; tests inject fixture factories.
   */
  createTrace?: TraceFactory
}) {
  const runtime = useNotebookRuntime(notebook, adapter)
  const busy = runtime.status === "busy"

  const toc = useMemo(() => service.extractToc(notebook), [notebook])
  const slugs = useMemo(() => toc.map((e) => e.slug), [toc])
  const activeSlug = useActiveHeading(slugs)

  const visualization = useVisualization({
    language: notebook.language,
    cells: runtime.cells,
    createTrace,
  })
  const active = visualization.active

  return (
    <div
      className={cn(
        "mx-auto flex w-full gap-8 px-4 py-6",
        active ? "max-w-7xl" : "max-w-6xl"
      )}
    >
      {/* TOC sidebar — left column, scroll-spy, sticky, hidden on small screens */}
      {toc.length > 0 && (
        <aside className="sticky top-24 hidden max-h-[calc(100svh-8rem)] w-56 shrink-0 self-start overflow-y-auto lg:block">
          <TableOfContents entries={toc} activeSlug={activeSlug} />
        </aside>
      )}

      {/* Main content */}
      <div className="min-w-0 flex-1">
        {/* Kernel bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2">
          <span className="text-sm text-muted-foreground">
            Kernel: {runtime.status}
          </span>
          {runUnavailableReason ? (
            <span className="text-xs text-muted-foreground">
              {runUnavailableReason}
            </span>
          ) : !signedIn ? (
            <Button type="button" size="sm" onClick={onSignIn}>
              Sign in to run
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || !adapter}
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
                  language={notebook.language}
                  disabled={!signedIn || busy || !adapter}
                  visualize={visualizeAvailability(
                    notebook.language,
                    runtime.cells[cell.id]!
                  )}
                  onChange={(source) => runtime.updateSource(cell.id, source)}
                  onRun={() => void runtime.runCell(cell.id)}
                  onVisualize={() => visualization.open(cell.id)}
                />
              )
            }
            if (cell.cellType === "markdown") {
              return <MarkdownCell key={cell.id} source={cell.source} />
            }
            return (
              <pre
                key={cell.id}
                className="rounded-lg border p-4 text-sm whitespace-pre-wrap"
              >
                {cell.source}
              </pre>
            )
          })}
        </div>
      </div>

      {/* Visualization panel — right column at lg, full-screen overlay below */}
      {active && (
        <aside className="fixed inset-0 z-50 overflow-y-auto bg-background p-4 lg:sticky lg:top-24 lg:z-auto lg:max-h-[calc(100svh-8rem)] lg:w-[30rem] lg:shrink-0 lg:self-start lg:overflow-visible lg:p-0">
          <VisualizePanel
            source={active.source}
            trace={active.trace}
            loading={active.loading}
            onClose={visualization.close}
            onRetry={visualization.retry}
          />
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
