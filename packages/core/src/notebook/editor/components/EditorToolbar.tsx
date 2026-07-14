"use client"

import { useState } from "react"
import {
  Check,
  Code2,
  Download,
  FileText,
  Globe,
  Link2,
  Play,
  Redo2,
  RotateCcw,
  Square,
  Undo2,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
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
  /** Public viewer URL shown/copied once published. */
  learnUrl?: string
  kernelStatus?: KernelStatus
  onInterrupt?: () => void
  onRestart?: () => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
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
  learnUrl,
  kernelStatus,
  onInterrupt,
  onRestart,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: EditorToolbarProps) {
  const [copied, setCopied] = useState(false)

  const copyLearnUrl = () => {
    if (!learnUrl) return
    const markCopied = () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    void navigator.clipboard.writeText(learnUrl).then(markCopied, () => {
      // Clipboard API needs focus + permission; textarea copy works everywhere.
      const el = document.createElement("textarea")
      el.value = learnUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      el.remove()
      markCopied()
    })
  }

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
        size="icon-sm"
        variant="ghost"
        disabled={!canUndo}
        title="Hoàn tác (Ctrl+Z)"
        aria-label="Hoàn tác"
        onClick={onUndo}
      >
        <Undo2 className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        disabled={!canRedo}
        title="Làm lại (Ctrl+Shift+Z)"
        aria-label="Làm lại"
        onClick={onRedo}
      >
        <Redo2 className="size-4" />
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

        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                size="sm"
                variant={published ? "default" : "outline"}
                title={
                  published
                    ? "Đang hiển thị trên /learn — bấm để xem tùy chọn"
                    : "Xuất bản lên /learn"
                }
              >
                <Globe className="size-4" />{" "}
                {published ? "Đã xuất bản" : "Xuất bản"}
              </Button>
            }
          />
          <PopoverContent side="bottom" align="end" className="w-80 gap-3">
            {published ? (
              <>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Globe className="size-4 text-primary" />
                  Notebook đang hiển thị công khai
                </p>
                {learnUrl && (
                  <div className="flex items-center gap-1.5">
                    <input
                      readOnly
                      value={learnUrl}
                      className="min-w-0 flex-1 rounded-md border bg-muted px-2 py-1.5 text-xs focus:outline-none"
                      onClick={(e) =>
                        (e.target as HTMLInputElement).select()
                      }
                    />
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      title={copied ? "Đã copy!" : "Copy link"}
                      onClick={copyLearnUrl}
                    >
                      {copied ? (
                        <Check className="size-4 text-green-600" />
                      ) : (
                        <Link2 className="size-4" />
                      )}
                    </Button>
                  </div>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={onTogglePublish}
                >
                  Hủy xuất bản
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Xuất bản để người dùng xem và chạy notebook trên trang{" "}
                  <code className="text-xs">/learn</code>.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  onClick={onTogglePublish}
                >
                  <Globe className="size-4" /> Xuất bản ngay
                </Button>
              </>
            )}
          </PopoverContent>
        </Popover>

        <Button type="button" size="sm" variant="outline" onClick={onDownload}>
          <Download className="size-4" /> .ipynb
        </Button>
      </div>
    </div>
  )
}
