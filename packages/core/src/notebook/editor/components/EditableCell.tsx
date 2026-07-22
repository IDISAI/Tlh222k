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
import {
  VisualizeCellAction,
  type VisualizeAvailability,
} from "../../visualize"

interface EditableCellProps {
  cell: NotebookCell
  /** Notebook language (nbformat); picks the code editor grammar. */
  language?: string
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
  /** "ready" = clickable action, "coming-soon" = disabled action, "hidden" = none. */
  visualize?: VisualizeAvailability
  onVisualize?: () => void
}

/** One editable cell, Colab-style: run gutter + editor + hover toolbar. */
export function EditableCell({
  cell,
  language,
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
  visualize = "hidden",
  onVisualize,
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
        {/* Frame matches the web viewer's code cell; selection is the one
            editor-only addition on top of it. */}
        <div
          className={cn(
            "relative overflow-hidden rounded-md border transition-colors",
            isCode &&
              "bg-muted/40 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30",
            selected && "border-primary/50 ring-1 ring-primary/20"
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
              language={language}
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

        {isCode && (
          <VisualizeCellAction
            availability={visualize}
            onVisualize={onVisualize}
          />
        )}

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
          !selected ? "hidden group-hover:flex" : isCode ? "flex" : "hidden" // markdown editing — never show, prevents overlap
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
