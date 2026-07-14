"use client"

import { useEffect, useRef } from "react"
import { EditorState, Prec } from "@codemirror/state"
import { EditorView, keymap } from "@codemirror/view"
import { python } from "@codemirror/lang-python"
import { oneDark } from "@codemirror/theme-one-dark"
import { basicSetup } from "codemirror"

interface CodeCellEditorProps {
  source: string
  onChange: (source: string) => void
  onFocus?: () => void
  /** Ctrl/Cmd+Enter: run the cell in place. */
  onRun?: () => void
  /** Shift+Enter: run the cell and move to the next one (Colab/Jupyter). */
  onRunAdvance?: () => void
}

const editorTheme = EditorView.theme({
  "&": { backgroundColor: "transparent", fontSize: "13px" },
  "&.cm-focused": { outline: "none" },
  ".cm-content": { fontFamily: "var(--font-mono, ui-monospace, monospace)", padding: "10px 0" },
  ".cm-gutters": { backgroundColor: "transparent", border: "none" },
})

/** Code cell input: CodeMirror 6 with Python highlighting and run keymaps. */
export function CodeCellEditor({
  source,
  onChange,
  onFocus,
  onRun,
  onRunAdvance,
}: CodeCellEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  // Latest callbacks without rebuilding the editor on every render.
  const callbacks = useRef({ onChange, onFocus, onRun, onRunAdvance })
  callbacks.current = { onChange, onFocus, onRun, onRunAdvance }

  useEffect(() => {
    const parent = containerRef.current
    if (!parent) return
    const extensions = [
      basicSetup,
      python(),
      editorTheme,
      Prec.highest(
        keymap.of([
          {
            key: "Shift-Enter",
            run: () => {
              callbacks.current.onRunAdvance?.()
              return true
            },
          },
          {
            key: "Mod-Enter",
            run: () => {
              callbacks.current.onRun?.()
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
    // ponytail: theme picked at mount; a mid-session light/dark toggle keeps
    // the old palette until remount. Watch documentElement if that matters.
    if (document.documentElement.classList.contains("dark")) {
      extensions.push(oneDark)
    }
    const view = new EditorView({
      state: EditorState.create({ doc: source, extensions }),
      parent,
    })
    viewRef.current = view
    return () => {
      viewRef.current = null
      view.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- editor is created once; source updates flow through the effect below
  }, [])

  // External source changes (kernel restart, load) replace the document.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== source) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: source } })
    }
  }, [source])

  return <div ref={containerRef} className="cm-cell w-full" />
}
