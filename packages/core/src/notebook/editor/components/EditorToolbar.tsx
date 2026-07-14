"use client"

import { Code2, Download, FileText, Globe, Play, Square, RotateCcw } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import type { KernelStatus } from "../../kernel"
import type { SaveState } from "../hooks/useNotebookEditor"

interface EditorToolbarProps {
  saveState: SaveState
  onAddCode: () => void
  onAddMarkdown: () => void
  onDownload: () => void
  /** Runs every code cell top-to-bottom; omit when no kernel is available. */
  onRunAll?: () => void
  running?: boolean
  published: boolean
  onTogglePublish: () => void
  kernelStatus?: KernelStatus
  onInterrupt?: () => void
  onRestart?: () => void
}

const SAVE_LABEL: Record<SaveState, string> = {
  idle: "",
  dirty: "Chưa lưu…",
  saving: "Đang lưu…",
  saved: "Đã lưu",
}

const KERNEL_LABEL: Record<KernelStatus, string> = {
  uninitialized: "chưa khởi động",
  starting: "đang khởi động…",
  idle: "sẵn sàng",
  busy: "đang chạy…",
  error: "lỗi",
}

/** Editor top bar. Run All requires a kernel (signed-in + kernel-server configured). */
export function EditorToolbar({
  saveState,
  onAddCode,
  onAddMarkdown,
  onDownload,
  onRunAll,
  running,
  published,
  onTogglePublish,
  kernelStatus,
  onInterrupt,
  onRestart,
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
        disabled={!onRunAll || running}
        title={onRunAll ? "Chạy tất cả code cell" : "Cần kernel để chạy code"}
        onClick={onRunAll}
      >
        <Play className="size-4" /> {running ? "Đang chạy…" : "Run All"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={!onInterrupt || kernelStatus !== "busy"}
        title="Dừng cell đang chạy"
        onClick={onInterrupt}
      >
        <Square className="size-4" /> Dừng
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={!onRestart}
        title="Khởi động lại kernel (xóa biến và output)"
        onClick={onRestart}
      >
        <RotateCcw className="size-4" /> Restart
      </Button>

      {kernelStatus && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={cn(
              "size-2 rounded-full",
              kernelStatus === "idle" && "bg-green-500",
              kernelStatus === "busy" && "bg-amber-500",
              kernelStatus === "starting" && "animate-pulse bg-amber-500",
              kernelStatus === "error" && "bg-destructive",
              kernelStatus === "uninitialized" && "bg-muted-foreground/40"
            )}
          />
          Kernel: {KERNEL_LABEL[kernelStatus]}
        </span>
      )}

      <div className="ml-auto flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {SAVE_LABEL[saveState]}
        </span>
        <Button
          type="button"
          size="sm"
          variant={published ? "default" : "outline"}
          onClick={onTogglePublish}
          title={
            published
              ? "Đang hiển thị trên trang /learn — bấm để gỡ"
              : "Xuất bản lên trang /learn"
          }
        >
          <Globe className="size-4" /> {published ? "Đã xuất bản" : "Xuất bản"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDownload}>
          <Download className="size-4" /> .ipynb
        </Button>
      </div>
    </div>
  )
}
