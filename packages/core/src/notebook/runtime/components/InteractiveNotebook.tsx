"use client"

import { useMemo } from "react"
import { Button } from "@workspace/ui/components/button"

import type { KernelAdapter, RunAvailability } from "../../kernel"
import {
  KernelActions,
  KernelBar,
  NotebookWorkspace,
  RunUnavailableNotice,
} from "../../layout"
import type { Notebook } from "../../types"
import { NotebookService } from "../../notebook.service"
import { MarkdownCell } from "../../viewer/components/MarkdownCell"
import { StartExerciseCard } from "../../viewer/components/StartExerciseCard"
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
  runAvailability,
  onStartExercise,
  exerciseTitle,
  createTrace,
}: {
  notebook: Notebook
  adapter: KernelAdapter | null
  signedIn?: boolean
  onSignIn?: () => void
  /**
   * Why cells cannot run here. Unrunnable is the normal state of the deployed
   * site for the five compiled languages, so it is explained above the cells
   * rather than hidden behind a disabled button.
   */
  runAvailability?: RunAvailability
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
    <NotebookWorkspace
      toc={toc}
      activeSlug={activeSlug}
      panel={
        active && (
          <VisualizePanel
            source={active.source}
            trace={active.trace}
            loading={active.loading}
            onClose={visualization.close}
            onRetry={visualization.retry}
          />
        )
      }
      floating={
        onStartExercise && exerciseTitle ? (
          <StartExerciseCard
            exerciseTitle={exerciseTitle}
            onStart={onStartExercise}
          />
        ) : undefined
      }
    >
      <>
        {runAvailability && !runAvailability.runnable && (
          <RunUnavailableNotice availability={runAvailability} />
        )}
        <KernelBar status={runtime.status}>
          {runAvailability && !runAvailability.runnable ? null : !signedIn ? (
            <Button type="button" size="sm" onClick={onSignIn}>
              Sign in to run
            </Button>
          ) : (
            <KernelActions
              busy={busy}
              disabled={!adapter}
              onRunAll={() => void runtime.runAll()}
              onInterrupt={() => void runtime.interrupt()}
              onRestart={() => void runtime.restart()}
            />
          )}
        </KernelBar>

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
      </>
    </NotebookWorkspace>
  )
}
