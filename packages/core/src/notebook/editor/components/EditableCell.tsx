"use client"

import type { ReactNode } from "react"
import { ArrowDown, ArrowUp, Copy, Trash2, Type } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import type { CellType, NotebookCell } from "../../types"
import { CellRunButton } from "./CellRunButton"
import { CodeCellEditor } from "./CodeCellEditor"
import { MarkdownCellEditor } from "./MarkdownCellEditor"
import { OutputRenderer } from "../../viewer/components/OutputRenderer"
import type { RuntimeCellState } from "../../runtime/use-notebook-runtime"

interface EditableCellProps {
  cell: NotebookCell
  selected: boolean
  onSelect: () => void
  onDeselect?: () => void
  onChange: (source: string) => void
  onToggleType: (type: CellType) => void
  onMove: (direction: "up" | "down") => void
  onDuplicate: () => void
  onDelete: () => void
  runtime?: RuntimeCellState
  onRun?: () => void
  /** Shift+Enter: run then focus the next cell (Colab behavior). */
  onRunAdvance?: () => void
}

/** One editable cell, Colab-style: run gutter + editor + hover toolbar. */
export function EditableCell({
  cell,
  selected,
  onSelect,
  onDeselect,
  onChange,
  onToggleType,
  onMove,
  onDuplicate,
  onDelete,
  runtime,
  onRun,
  onRunAdvance,
}: EditableCellProps) {
  const isCode = cell.cellType === "code"

  return (
    <div onClick={onSelect} className="group relative flex gap-2">
      <div className="flex w-10 shrink-0 justify-center pt-1.5">
        {isCode && (
          <CellRunButton
            running={runtime?.running}
            disabled={!onRun}
            executionCount={runtime?.executionCount ?? cell.executionCount}
            onRun={onRun}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "relative overflow-hidden rounded-md border transition-all",
            selected
              ? "border-primary/50 shadow-md ring-2 ring-primary/15"
              : "border-transparent group-hover:border-border group-hover:shadow-sm",
            isCode && "bg-muted/40"
          )}
        >
          {/* Colab-style accent bar on the active cell. */}
          <span
            className={cn(
              "absolute inset-y-0 left-0 z-10 w-1 rounded-r bg-primary transition-opacity",
              selected ? "opacity-100" : "opacity-0"
            )}
          />
          {isCode ? (
            <CodeCellEditor
              source={cell.source}
              onChange={onChange}
              onFocus={onSelect}
              onRun={onRun}
              onRunAdvance={onRunAdvance}
            />
          ) : (
            <MarkdownCellEditor
              source={cell.source}
              editing={selected}
              onChange={onChange}
              onFocus={onSelect}
              onClose={onDeselect}
            />
          )}
        </div>

        {isCode && runtime && runtime.outputs.length > 0 && (
          <div className="space-y-2 px-3 py-2">
            {runtime.outputs.map((output, index) => (
              <OutputRenderer key={index} output={output} />
            ))}
          </div>
        )}
      </div>

      <div
        className={cn(
          "absolute right-2 bottom-full z-10 mb-1 items-center gap-0.5 rounded-md border bg-background p-0.5 shadow-sm",
          selected ? "flex" : "hidden group-hover:flex"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <IconButton
          label={isCode ? "Chuyển sang Markdown" : "Chuyển sang Code"}
          onClick={() => onToggleType(isCode ? "markdown" : "code")}
        >
          <Type className="size-3.5" />
        </IconButton>
        <IconButton label="Di chuyển lên" onClick={() => onMove("up")}>
          <ArrowUp className="size-3.5" />
        </IconButton>
        <IconButton label="Di chuyển xuống" onClick={() => onMove("down")}>
          <ArrowDown className="size-3.5" />
        </IconButton>
        <IconButton label="Nhân bản" onClick={onDuplicate}>
          <Copy className="size-3.5" />
        </IconButton>
        <IconButton label="Xóa" onClick={onDelete}>
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      size="icon-xs"
      variant="ghost"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
