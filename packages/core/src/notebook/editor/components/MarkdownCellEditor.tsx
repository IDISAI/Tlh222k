"use client"

import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import {
  Bold,
  Code2,
  Heading,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Quote,
} from "lucide-react"

import { MarkdownCell } from "../../viewer/components/MarkdownCell"

interface MarkdownCellEditorProps {
  source: string
  /** Selected cells edit; unselected render as preview (Jupyter behavior). */
  editing: boolean
  onChange: (source: string) => void
  onFocus?: () => void
  /** Leave edit mode (the toolbar's "Đóng" button). */
  onClose?: () => void
}

/**
 * Markdown cell, Colab-style: rendered preview when idle; while editing, a
 * formatting toolbar over a source/live-preview split view.
 */
export function MarkdownCellEditor({
  source,
  editing,
  onChange,
  onFocus,
  onClose,
}: MarkdownCellEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!editing) return
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [editing, source])

  useEffect(() => {
    if (editing) ref.current?.focus()
  }, [editing])

  if (!editing) {
    return (
      <div className="px-4 py-3">
        {source.trim() ? (
          <MarkdownCell source={source} />
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Empty markdown cell — click to edit
          </p>
        )}
      </div>
    )
  }

  /** Wrap the selection with inline markers, e.g. bold / italic / code. */
  const wrap = (before: string, after: string) => {
    const el = ref.current
    if (!el) return
    const { selectionStart: start, selectionEnd: end, value } = el
    onChange(
      value.slice(0, start) + before + value.slice(start, end) + after + value.slice(end)
    )
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + before.length, end + before.length)
    })
  }

  /** Prefix the current line, e.g. heading / list / quote. */
  const prefixLine = (prefix: string) => {
    const el = ref.current
    if (!el) return
    const { selectionStart: start, value } = el
    const lineStart = value.lastIndexOf("\n", start - 1) + 1
    onChange(value.slice(0, lineStart) + prefix + value.slice(lineStart))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + prefix.length, start + prefix.length)
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1">
        <ToolButton label="Tiêu đề" onClick={() => prefixLine("## ")}>
          <Heading className="size-3.5" />
        </ToolButton>
        <ToolButton label="Đậm" onClick={() => wrap("**", "**")}>
          <Bold className="size-3.5" />
        </ToolButton>
        <ToolButton label="Nghiêng" onClick={() => wrap("*", "*")}>
          <Italic className="size-3.5" />
        </ToolButton>
        <ToolButton label="Code" onClick={() => wrap("`", "`")}>
          <Code2 className="size-3.5" />
        </ToolButton>
        <ToolButton label="Liên kết" onClick={() => wrap("[", "](url)")}>
          <Link className="size-3.5" />
        </ToolButton>
        <ToolButton label="Hình ảnh" onClick={() => wrap("![", "](url)")}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- lucide icon, not an img element */}
          <Image className="size-3.5" />
        </ToolButton>
        <ToolButton label="Trích dẫn" onClick={() => prefixLine("> ")}>
          <Quote className="size-3.5" />
        </ToolButton>
        <ToolButton label="Danh sách" onClick={() => prefixLine("- ")}>
          <List className="size-3.5" />
        </ToolButton>
        <ToolButton label="Danh sách số" onClick={() => prefixLine("1. ")}>
          <ListOrdered className="size-3.5" />
        </ToolButton>
        <ToolButton label="Đường kẻ" onClick={() => wrap("\n---\n", "")}>
          <Minus className="size-3.5" />
        </ToolButton>
        <button
          type="button"
          onClick={(e) => {
            // The cell wrapper's click handler re-selects; closing must win.
            e.stopPropagation()
            onClose?.()
          }}
          className="ml-auto px-2 py-0.5 text-xs font-medium text-primary hover:underline"
        >
          Đóng
        </button>
      </div>

      <div className="grid md:grid-cols-2 md:divide-x">
        <textarea
          ref={ref}
          value={source}
          spellCheck={false}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          className="w-full resize-none bg-transparent px-4 py-3 font-mono text-sm leading-6 outline-none"
          rows={3}
          placeholder="# Markdown"
        />
        <div className="hidden min-w-0 px-4 py-3 md:block">
          {source.trim() ? (
            <MarkdownCell source={source} />
          ) : (
            <p className="text-sm text-muted-foreground italic">Xem trước</p>
          )}
        </div>
      </div>
    </div>
  )
}

function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  )
}
