"use client"

import { Code2, Download, FileText, Play } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

import type { SaveState } from "../hooks/useNotebookEditor"

interface EditorToolbarProps {
  saveState: SaveState
  onAddCode: () => void
  onAddMarkdown: () => void
  onDownload: () => void
}

const SAVE_LABEL: Record<SaveState, string> = {
  idle: "",
  dirty: "Chưa lưu…",
  saving: "Đang lưu…",
  saved: "Đã lưu",
}

/** Editor top bar. Run All is disabled until kernel execution lands (Phase 3). */
export function EditorToolbar({
  saveState,
  onAddCode,
  onAddMarkdown,
  onDownload,
}: EditorToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
      <Button type="button" size="sm" variant="outline" onClick={onAddCode}>
        <Code2 className="size-4" /> Code
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onAddMarkdown}>
        <FileText className="size-4" /> Markdown
      </Button>

      <div className="mx-1 h-5 w-px bg-border" />

      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled
        title="Chạy code sẽ có ở Phase 3 (kernel)"
      >
        <Play className="size-4" /> Run All
      </Button>

      <div className="ml-auto flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {SAVE_LABEL[saveState]}
        </span>
        <Button type="button" size="sm" variant="outline" onClick={onDownload}>
          <Download className="size-4" /> .ipynb
        </Button>
      </div>
    </div>
  )
}
