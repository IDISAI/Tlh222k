"use client"

import { useEffect, useRef } from "react"

interface CodeCellEditorProps {
  source: string
  onChange: (source: string) => void
  onFocus?: () => void
}

/**
 * Code cell input. v1 is an auto-growing monospace textarea (native, no deps);
 * CodeMirror 6 replaces this component in a later pass without touching callers.
 */
export function CodeCellEditor({
  source,
  onChange,
  onFocus,
}: CodeCellEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Grow to fit content so the whole cell is visible (notebook-style).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [source])

  return (
    <textarea
      ref={ref}
      value={source}
      spellCheck={false}
      onFocus={onFocus}
      onChange={(e) => onChange(e.target.value)}
      className="w-full resize-none bg-transparent px-4 py-3 font-mono text-sm leading-6 outline-none"
      rows={1}
      placeholder="# code"
    />
  )
}
