"use client"

import type { ReactNode } from "react"
import { ArrowDown, ArrowUp, Copy, Play, Trash2, Type } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import type { CellType, NotebookCell } from "../../types"
import { CodeCellEditor } from "./CodeCellEditor"
import { MarkdownCellEditor } from "./MarkdownCellEditor"
import { OutputRenderer } from "../../viewer/components/OutputRenderer"
import type { RuntimeCellState } from "../../runtime/use-notebook-runtime"

interface EditableCellProps {
  cell: NotebookCell
  selected: boolean
  onSelect: () => void
  onChange: (source: string) => void
  onToggleType: (type: CellType) => void
  onMove: (direction: "up" | "down") => void
  onDuplicate: () => void
  onDelete: () => void
  runtime?: RuntimeCellState
  onRun?: () => void
}

/** One editable cell: prompt gutter + editor + hover toolbar. */
export function EditableCell({
  cell,
  selected,
  onSelect,
  onChange,
  onToggleType,
  onMove,
  onDuplicate,
  onDelete,
  runtime,
  onRun,
}: EditableCellProps) {
  const isCode = cell.cellType === "code"
  const prompt = isCode
    ? `In [${runtime?.running ? "*" : (runtime?.executionCount ?? cell.executionCount ?? " ")}]:`
    : ""

  return (
    <div
      onClick={onSelect}
      className={cn(
        "group relative flex gap-2 rounded-md border transition-colors",
        selected
          ? "border-primary ring-1 ring-primary/30"
          : "border-transparent hover:border-border"
      )}
    >
      <div className="w-16 shrink-0 pt-3 pr-1 text-right font-mono text-xs text-muted-foreground">
        {prompt}
      </div>

      <div className={cn("min-w-0 flex-1 rounded-r-md", isCode && "bg-muted/40")}>
        {isCode ? (
          <CodeCellEditor
            source={cell.source}
            onChange={onChange}
            onFocus={onSelect}
          />
        ) : (
          <MarkdownCellEditor
            source={cell.source}
            editing={selected}
            onChange={onChange}
            onFocus={onSelect}
          />
        )}
      </div>

      <div
        className={cn(
          "absolute -top-3 right-2 items-center gap-0.5 rounded-md border bg-background p-0.5 shadow-sm",
          selected ? "flex" : "hidden group-hover:flex"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <IconButton label="Run cell" disabled={!isCode || !onRun || runtime?.running} onClick={onRun}>
          <Play className="size-3.5" />
        </IconButton>
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
      {isCode && runtime && runtime.outputs.length > 0 && (
        <div className="absolute top-full right-0 left-16 z-10 space-y-2 rounded-b-md border border-t-0 bg-background p-3 shadow-sm">
          {runtime.outputs.map((output, index) => <OutputRenderer key={index} output={output} />)}
        </div>
      )}
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
