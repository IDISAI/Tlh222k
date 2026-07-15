"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, Circle, Loader2, Play, RotateCcw, XCircle } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import type { CellOutput, Notebook } from "../../types"
import type { GradeMap, KernelStatus } from "../../kernel/types"
import { useKernel } from "../../kernel/hooks/useKernel"
import { MarkdownCell } from "../../viewer/components/MarkdownCell"
import { OutputRenderer } from "../../viewer/components/OutputRenderer"
import { CodeCellEditor } from "../../editor/components/CodeCellEditor"
import { computeProgress, extractQuestionIds } from "../exercise.service"
import type { ExerciseCellState } from "../types"

export interface ExerciseViewProps {
  /** The companion exercise notebook (editable copy). */
  notebook: Notebook
  /**
   * Factory for the Pyodide Web Worker. Supplied by the app so its bundler
   * owns worker bundling, e.g.
   * `() => new Worker(new URL("./pyodide.worker.ts", import.meta.url))`.
   */
  createWorker: () => Worker
}

/** Append text to a trailing stream output of the same name, else push a new one. */
function appendStream(
  outputs: CellOutput[],
  name: "stdout" | "stderr",
  text: string
): CellOutput[] {
  const last = outputs[outputs.length - 1]
  if (last && last.kind === "stream" && last.name === name) {
    return [
      ...outputs.slice(0, -1),
      { ...last, text: last.text + text },
    ]
  }
  return [...outputs, { kind: "stream", name, text }]
}

/**
 * The Exercise tab: an editable copy of the exercise notebook, run cell-by-cell
 * client-side via Pyodide. Lazy boot — nothing loads until the first Run.
 */
export function ExerciseView({ notebook, createWorker }: ExerciseViewProps) {
  const { status, getAdapter, restart } = useKernel(createWorker)

  const [cells, setCells] = useState<Record<string, ExerciseCellState>>(() => {
    const initial: Record<string, ExerciseCellState> = {}
    for (const cell of notebook.cells) {
      if (cell.cellType === "code") {
        initial[cell.id] = {
          source: cell.source,
          outputs: [],
          executionCount: null,
          running: false,
        }
      }
    }
    return initial
  })

  const [grades, setGrades] = useState<GradeMap>({})

  const questionIds = useMemo(() => extractQuestionIds(notebook), [notebook])
  const progress = useMemo(
    () => computeProgress(questionIds, grades),
    [questionIds, grades]
  )

  const patchCell = (id: string, patch: Partial<ExerciseCellState>) =>
    setCells((prev) => ({ ...prev, [id]: { ...prev[id]!, ...patch } }))

  const anyRunning = Object.values(cells).some((c) => c.running)

  async function runCell(id: string): Promise<void> {
    if (anyRunning) return
    const source = cells[id]!.source
    patchCell(id, { running: true, outputs: [] })
    let outputs: CellOutput[] = []
    const flush = () => patchCell(id, { outputs })

    try {
      const { executionCount } = await getAdapter().execute(source, {
        onStream: (name, text) => {
          outputs = appendStream(outputs, name, text)
          flush()
        },
        onOutput: (output) => {
          outputs = [...outputs, output]
          flush()
        },
        onGrades: (g) => setGrades((prev) => ({ ...prev, ...g })),
      })
      patchCell(id, { running: false, executionCount, outputs })
    } catch (error) {
      outputs = [
        ...outputs,
        {
          kind: "error",
          ename: "KernelError",
          evalue: error instanceof Error ? error.message : String(error),
          traceback: [],
        },
      ]
      patchCell(id, { running: false, outputs })
    }
  }

  async function runAll(): Promise<void> {
    for (const cell of notebook.cells) {
      if (cell.cellType === "code") await runCell(cell.id)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <ExerciseHeader
        status={status}
        progress={progress}
        busy={anyRunning}
        onRunAll={runAll}
        onRestart={restart}
      />

      <div className="mt-6 space-y-4">
        {notebook.cells.map((cell) =>
          cell.cellType === "code" ? (
            <ExerciseCodeCell
              key={cell.id}
              state={cells[cell.id]!}
              disabled={anyRunning}
              onChange={(source) => patchCell(cell.id, { source })}
              onRun={() => runCell(cell.id)}
            />
          ) : cell.cellType === "markdown" ? (
            <div key={cell.id} className="px-1 py-2">
              <MarkdownCell source={cell.source} />
            </div>
          ) : null
        )}
      </div>
    </div>
  )
}

function ExerciseHeader({
  status,
  progress,
  busy,
  onRunAll,
  onRestart,
}: {
  status: KernelStatus
  progress: ReturnType<typeof computeProgress>
  busy: boolean
  onRunAll: () => void
  onRestart: () => void
}) {
  const pct =
    progress.total === 0 ? 0 : Math.round((progress.correct / progress.total) * 100)

  return (
    <div className="sticky top-0 z-10 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <KernelStatusPill status={status} />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRunAll}
            disabled={busy}
          >
            <Play className="size-3.5" />
            Run all
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onRestart}
            disabled={status === "uninitialized"}
            title="Restart the Python session (clears all variables)"
          >
            <RotateCcw className="size-3.5" />
            Restart
          </Button>
        </div>
      </div>

      {progress.total > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {progress.correct} / {progress.total} questions correct
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {progress.questionIds.map((id) => (
              <QuestionChip key={id} id={id} grade={progress.grades[id]!} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function QuestionChip({
  id,
  grade,
}: {
  id: string
  grade: "unattempted" | "correct" | "incorrect"
}) {
  const Icon =
    grade === "correct" ? CheckCircle2 : grade === "incorrect" ? XCircle : Circle
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        grade === "correct" &&
          "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
        grade === "incorrect" &&
          "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
        grade === "unattempted" && "text-muted-foreground"
      )}
    >
      <Icon className="size-3" />
      {id}
    </span>
  )
}

const STATUS_LABEL: Record<KernelStatus, string> = {
  uninitialized: "Session off — run a cell to start",
  starting: "Starting Python…",
  idle: "Python ready",
  busy: "Running…",
  error: "Session error",
}

function KernelStatusPill({ status }: { status: KernelStatus }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      {status === "starting" || status === "busy" ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <span
          className={cn(
            "size-2 rounded-full",
            status === "idle" && "bg-green-500",
            status === "error" && "bg-red-500",
            status === "uninitialized" && "bg-muted-foreground/40"
          )}
        />
      )}
      {STATUS_LABEL[status]}
    </span>
  )
}

function ExerciseCodeCell({
  state,
  disabled,
  onChange,
  onRun,
}: {
  state: ExerciseCellState
  disabled: boolean
  onChange: (source: string) => void
  onRun: () => void
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-stretch">
        <div className="flex w-14 shrink-0 flex-col items-center justify-start border-r bg-muted/40 py-3">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={onRun}
            disabled={disabled}
            title="Run this cell (client-side Python)"
          >
            {state.running ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
          </Button>
          <span className="mt-1 font-mono text-[11px] text-muted-foreground">
            {state.running ? "[*]" : state.executionCount ?? " "}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <CodeCellEditor source={state.source} onChange={onChange} />
        </div>
      </div>

      {state.outputs.length > 0 && (
        <div className="space-y-2 border-t bg-muted/20 px-4 py-3">
          {state.outputs.map((output, i) => (
            <OutputRenderer key={i} output={output} />
          ))}
        </div>
      )}
    </div>
  )
}
