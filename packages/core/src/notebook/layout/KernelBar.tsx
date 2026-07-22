"use client"

// Kernel status + run controls, defined by the web viewer and reused by the
// admin editor. Both surfaces show the same box in the same place above the
// cells, so a learner and an author read the same runtime state.

import type { ReactNode } from "react"
import { Play, RotateCcw, Square } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

import type { KernelStatus } from "../kernel"

export function KernelBar({
  status,
  children,
}: {
  status: KernelStatus
  /** Right-hand side: run controls, a sign-in button, or a reason string. */
  children?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2">
      <span className="text-sm text-muted-foreground">Kernel: {status}</span>
      {children}
    </div>
  )
}

export function KernelActions({
  busy,
  disabled,
  onRunAll,
  onInterrupt,
  onRestart,
}: {
  busy: boolean
  /** No kernel available; Run all stays visible but inert. */
  disabled?: boolean
  onRunAll: () => void
  onInterrupt: () => void
  onRestart: () => void
}) {
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy || disabled}
        onClick={onRunAll}
      >
        <Play className="size-3.5" /> Run all
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!busy}
        onClick={onInterrupt}
      >
        <Square className="size-3.5" /> Interrupt
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onRestart}>
        <RotateCcw className="size-3.5" /> Restart
      </Button>
    </div>
  )
}
