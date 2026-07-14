"use client"

import { CellRunButton } from "../../editor/components/CellRunButton"
import { CodeCellEditor } from "../../editor/components/CodeCellEditor"
import { OutputRenderer } from "../../viewer/components/OutputRenderer"
import type { RuntimeCellState } from "../use-notebook-runtime"

export function InteractiveCodeCell({
  cell,
  disabled,
  onChange,
  onRun,
}: {
  cell: RuntimeCellState
  disabled?: boolean
  onChange: (source: string) => void
  onRun: () => void
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
          <CodeCellEditor source={cell.source} onChange={onChange} />
        </div>
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
