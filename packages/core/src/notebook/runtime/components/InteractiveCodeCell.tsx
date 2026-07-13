"use client"

import { Play } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

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
    <section className="overflow-hidden rounded-lg border bg-background">
      <div className="flex bg-muted/40">
        <span className="w-20 shrink-0 pt-3 pr-2 text-right font-mono text-xs text-muted-foreground">
          In [{cell.running ? "*" : (cell.executionCount ?? " ")}]:
        </span>
        <div className="min-w-0 flex-1"><CodeCellEditor source={cell.source} onChange={onChange} /></div>
      </div>
      <div className="flex justify-end border-t px-3 py-2">
        <Button type="button" size="sm" disabled={disabled || cell.running} onClick={onRun}>
          <Play className="size-3.5" /> {cell.running ? "Running" : "Run cell"}
        </Button>
      </div>
      {cell.outputs.length > 0 && (
        <div className="space-y-2 border-t p-3">
          {cell.outputs.map((output, index) => <OutputRenderer key={index} output={output} />)}
        </div>
      )}
    </section>
  )
}
