"use client"

import { Play, RotateCcw, Square } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

import type { KernelAdapter } from "../../kernel"
import type { Notebook } from "../../types"
import { MarkdownCell } from "../../viewer/components/MarkdownCell"
import { useNotebookRuntime } from "../use-notebook-runtime"
import { InteractiveCodeCell } from "./InteractiveCodeCell"

export function InteractiveNotebook({
  notebook,
  adapter,
  signedIn = true,
  onSignIn,
}: {
  notebook: Notebook
  adapter: KernelAdapter | null
  signedIn?: boolean
  onSignIn?: () => void
}) {
  const runtime = useNotebookRuntime(notebook, adapter)
  const busy = runtime.status === "busy"
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2">
        <span className="text-sm text-muted-foreground">Kernel: {runtime.status}</span>
        {!signedIn ? (
          <Button type="button" size="sm" onClick={onSignIn}>Sign in to run</Button>
        ) : (
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void runtime.runAll()}><Play className="size-3.5" /> Run all</Button>
            <Button type="button" size="sm" variant="outline" disabled={!busy} onClick={() => void runtime.interrupt()}><Square className="size-3.5" /> Interrupt</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void runtime.restart()}><RotateCcw className="size-3.5" /> Restart</Button>
          </div>
        )}
      </div>
      {runtime.error && <p role="alert" className="text-sm text-destructive">{runtime.error}</p>}
      {notebook.cells.map((cell) => cell.cellType === "code" ? (
        <InteractiveCodeCell key={cell.id} cell={runtime.cells[cell.id]!} disabled={!signedIn || busy} onChange={(source) => runtime.updateSource(cell.id, source)} onRun={() => void runtime.runCell(cell.id)} />
      ) : cell.cellType === "markdown" ? (
        <MarkdownCell key={cell.id} source={cell.source} />
      ) : <pre key={cell.id} className="whitespace-pre-wrap rounded-lg border p-4 text-sm">{cell.source}</pre>)}
    </div>
  )
}
