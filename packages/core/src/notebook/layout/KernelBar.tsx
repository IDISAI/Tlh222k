"use client"

// Kernel status + run controls, defined by the web viewer and reused by the
// admin editor. Both surfaces show the same box in the same place above the
// cells, so a learner and an author read the same runtime state.

import type { ReactNode } from "react"
import { Info, Play, RotateCcw, Square } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

import type { KernelStatus } from "../kernel"
import type { RunAvailability } from "../kernel/run-availability"

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

/**
 * Why this notebook cannot run. Reads as an explanation rather than an error:
 * for five of the seven languages this is the normal state of the deployed
 * site, not something the reader did wrong.
 */
export function RunUnavailableNotice({
  availability,
}: {
  availability: Extract<RunAvailability, { runnable: false }>
}) {
  return (
    <div className="mb-6 flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
      <Info className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
      <div className="min-w-0">
        <p className="text-sm font-medium">{availability.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {availability.detail}
        </p>
      </div>
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
