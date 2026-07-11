"use client"

import { useEffect, useRef, useState } from "react"

import { MarkdownCell } from "../../viewer/components/MarkdownCell"

interface MarkdownCellEditorProps {
  source: string
  /** Selected cells edit; unselected render as preview (Jupyter behavior). */
  editing: boolean
  onChange: (source: string) => void
  onFocus?: () => void
}

/** Markdown cell: raw textarea while editing, rendered preview otherwise. */
export function MarkdownCellEditor({
  source,
  editing,
  onChange,
  onFocus,
}: MarkdownCellEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [autoHeight, setAutoHeight] = useState(false)

  useEffect(() => {
    if (!editing) return
    setAutoHeight(true)
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
    el.focus()
  }, [editing, source])

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

  return (
    <textarea
      ref={ref}
      value={source}
      spellCheck={false}
      onFocus={onFocus}
      onChange={(e) => onChange(e.target.value)}
      className="w-full resize-none bg-transparent px-4 py-3 font-mono text-sm leading-6 outline-none"
      rows={autoHeight ? undefined : 3}
      placeholder="# Markdown"
    />
  )
}
