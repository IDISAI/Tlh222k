"use client"

import { useState } from "react"
import {
  Check,
  Code2,
  Download,
  FileText,
  Globe,
  Link2,
  Redo2,
  Undo2,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { LANGUAGES } from "../../kernel"
import type { SaveState } from "../hooks/useNotebookEditor"

interface EditorToolbarProps {
  saveState: SaveState
  /** Notebook language (nbformat); shown in the language selector. */
  language?: string
  /** Switches the notebook language (rewrites kernelspec + profile). */
  onLanguageChange?: (language: string) => void
  onAddCode: () => void
  onAddMarkdown: () => void
  onDownload: () => void
  published: boolean
  onTogglePublish: () => void
  /** Public viewer URL shown/copied once published. */
  learnUrl?: string
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

/**
 * Editor top bar: authoring actions only. Kernel status and the run controls
 * live in the shared KernelBar above the cells, exactly as the web viewer
 * presents them.
 */
export function EditorToolbar({
  saveState,
  language,
  onLanguageChange,
  onAddCode,
  onAddMarkdown,
  onDownload,
  published,
  onTogglePublish,
  learnUrl,
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

      {language && onLanguageChange && (
        <>
          <Select
            value={language}
            onValueChange={(value) => onLanguageChange(String(value))}
          >
            <SelectTrigger
              size="sm"
              title="Ngôn ngữ của notebook (mỗi notebook một ngôn ngữ)"
              aria-label="Ngôn ngữ notebook"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((spec) => (
                <SelectItem key={spec.language} value={spec.language}>
                  {spec.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mx-1 h-5 w-px bg-border" />
        </>
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
                    ? "Đang hiển thị trên /notebooks — bấm để xem tùy chọn"
                    : "Xuất bản lên /notebooks"
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
                      onClick={(e) => (e.target as HTMLInputElement).select()}
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
                  <code className="text-xs">/notebooks</code>.
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
