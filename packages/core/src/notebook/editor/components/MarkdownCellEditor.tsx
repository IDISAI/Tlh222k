"use client"

import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { EditorState, Prec } from "@codemirror/state"
import { EditorView, keymap, placeholder } from "@codemirror/view"
import { markdown } from "@codemirror/lang-markdown"
import { oneDark } from "@codemirror/theme-one-dark"
import { basicSetup } from "codemirror"
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

const editorTheme = EditorView.theme({
  "&": { backgroundColor: "transparent", fontSize: "13px" },
  "&.cm-focused": { outline: "none" },
  ".cm-content": {
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    padding: "10px 0",
  },
  ".cm-gutters": { display: "none" },
  ".cm-line": { padding: "0 16px" },
})

/**
 * Markdown cell, Colab-style: rendered preview when idle; while editing, a
 * formatting toolbar over a highlighted source / live-preview split view.
 */
export function MarkdownCellEditor({
  source,
  editing,
  onChange,
  onFocus,
  onClose,
}: MarkdownCellEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const callbacks = useRef({ onChange, onFocus, onClose })
  callbacks.current = { onChange, onFocus, onClose }

  useEffect(() => {
    if (!editing) return
    const parent = containerRef.current
    if (!parent) return
    const extensions = [
      basicSetup,
      markdown(),
      editorTheme,
      EditorView.lineWrapping,
      placeholder("# Markdown"),
      Prec.highest(
        keymap.of([
          {
            key: "Shift-Enter",
            run: () => {
              // Shift+Enter renders the markdown, like Colab/Jupyter.
              callbacks.current.onClose?.()
              return true
            },
          },
        ])
      ),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          callbacks.current.onChange(update.state.doc.toString())
        }
        if (update.focusChanged && update.view.hasFocus) {
          callbacks.current.onFocus?.()
        }
      }),
    ]
    // ponytail: theme picked at mount, same ceiling as CodeCellEditor.
    if (document.documentElement.classList.contains("dark")) {
      extensions.push(oneDark)
    }
    const view = new EditorView({
      state: EditorState.create({ doc: source, extensions }),
      parent,
    })
    viewRef.current = view
    view.focus()
    return () => {
      viewRef.current = null
      view.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- editor is created per edit session; source updates flow through the effect below
  }, [editing])

  // External source changes (undo/redo, load) replace the document.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== source) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: source } })
    }
  }, [source])

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
    const view = viewRef.current
    if (!view) return
    const { from, to } = view.state.selection.main
    view.dispatch({
      changes: [
        { from, insert: before },
        { from: to, insert: after },
      ],
      selection: { anchor: from + before.length, head: to + before.length },
    })
    view.focus()
  }

  /** Prefix the current line, e.g. heading / list / quote. */
  const prefixLine = (prefix: string) => {
    const view = viewRef.current
    if (!view) return
    const { head } = view.state.selection.main
    const line = view.state.doc.lineAt(head)
    view.dispatch({
      changes: { from: line.from, insert: prefix },
      selection: { anchor: head + prefix.length },
    })
    view.focus()
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
        <div ref={containerRef} className="cm-cell min-w-0" />
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
