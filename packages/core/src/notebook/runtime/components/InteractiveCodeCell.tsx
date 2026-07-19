"use client"

import { Eye } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

import { CellRunButton } from "../../editor/components/CellRunButton"
import { CodeCellEditor } from "../../editor/components/CodeCellEditor"
import { OutputRenderer } from "../../viewer/components/OutputRenderer"
import type { VisualizeAvailability } from "../../visualize"
import type { RuntimeCellState } from "../use-notebook-runtime"

export function InteractiveCodeCell({
  cell,
  language,
  disabled,
  visualize = "hidden",
  onChange,
  onRun,
  onVisualize,
}: {
  cell: RuntimeCellState
  /** Notebook language (nbformat); picks the code editor grammar. */
  language?: string
  disabled?: boolean
  /** "ready" = clickable action, "coming-soon" = disabled action, "hidden" = none. */
  visualize?: VisualizeAvailability
  onChange: (source: string) => void
  onRun: () => void
  onVisualize?: () => void
}) {
  return (
    <section className="flex gap-2">
      <div className="flex w-10 shrink-0 justify-center pt-1.5">
        <CellRunButton
          running={cell.running}
          disabled={disabled}
          executionCount={cell.executionCount}
          onRun={onRun}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="rounded-md border bg-muted/40 transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30">
          <CodeCellEditor
            source={cell.source}
            language={language}
            onChange={onChange}
            onRun={disabled ? undefined : onRun}
            onRunAdvance={disabled ? undefined : onRun}
          />
        </div>
        {visualize !== "hidden" && (
          <div className="mt-1.5 flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={visualize === "coming-soon"}
              title={
                visualize === "coming-soon"
                  ? "Coming soon for this language"
                  : undefined
              }
              onClick={onVisualize}
            >
              <Eye className="size-3.5" /> Visualize execution
            </Button>
          </div>
        )}
        {cell.outputs.length > 0 && (
          <div className="space-y-2 px-3 py-2">
            {cell.outputs.map((output, index) => (
              <OutputRenderer key={index} output={output} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
