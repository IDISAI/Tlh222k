"use client"

import { Loader2, Play } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

interface CellRunButtonProps {
  running?: boolean
  /** No kernel available (signed out / kernel-server unset). */
  disabled?: boolean
  executionCount?: number | null
  onRun?: () => void
}

/** Colab-style circular run control in the cell's left gutter. */
export function CellRunButton({
  running,
  disabled,
  executionCount,
  onRun,
}: CellRunButtonProps) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        aria-label="Run cell"
        title={disabled ? "Cần kernel để chạy code" : "Chạy cell"}
        disabled={disabled || running}
        onClick={(e) => {
          e.stopPropagation()
          onRun?.()
        }}
        className={cn(
          "flex size-7 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors",
          disabled
            ? "opacity-40"
            : "hover:border-primary hover:text-primary"
        )}
      >
        {running ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Play className="size-3.5" />
        )}
      </button>
      <span className="font-mono text-[10px] text-muted-foreground">
        [{running ? "*" : (executionCount ?? " ")}]
      </span>
    </div>
  )
}
