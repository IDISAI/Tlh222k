"use client"

import { useEffect, useRef } from "react"
import {
  Compartment,
  EditorState,
  Prec,
  type Extension,
} from "@codemirror/state"
import { EditorView, keymap } from "@codemirror/view"
import { cpp } from "@codemirror/lang-cpp"
import { go } from "@codemirror/lang-go"
import { java } from "@codemirror/lang-java"
import { javascript } from "@codemirror/lang-javascript"
import { python } from "@codemirror/lang-python"
import { rust } from "@codemirror/lang-rust"
import { oneDark } from "@codemirror/theme-one-dark"
import { julia } from "@plutojl/lang-julia"
import { basicSetup } from "codemirror"

import type { NotebookLanguage } from "../../kernel/languages"
import { useDarkMode } from "../hooks/useDarkMode"

// One grammar registry keeps editor behavior aligned with notebook metadata.
const LANGUAGE_EXTENSIONS: Partial<Record<NotebookLanguage, () => Extension>> =
  {
    python,
    javascript: () => javascript(),
    cpp,
    java,
    rust,
    go,
    julia,
  }

interface CodeCellEditorProps {
  source: string
  onChange: (source: string) => void
  /** Notebook language (nbformat); picks the CodeMirror grammar. */
  language?: string
  onFocus?: () => void
  /** Ctrl/Cmd+Enter: run the cell in place. */
  onRun?: () => void
  /** Shift+Enter: run the cell and move to the next one (Colab/Jupyter). */
  onRunAdvance?: () => void
}

const editorTheme = EditorView.theme({
  "&": { backgroundColor: "transparent", fontSize: "13px" },
  "&.cm-focused": { outline: "none" },
  ".cm-content": {
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    padding: "10px 0",
  },
  ".cm-gutters": { backgroundColor: "transparent", border: "none" },
})

/** Code cell input: CodeMirror 6 with per-language highlighting and run keymaps. */
export function CodeCellEditor({
  source,
  onChange,
  language = "python",
  onFocus,
  onRun,
  onRunAdvance,
}: CodeCellEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  // Latest callbacks without rebuilding the editor on every render.
  const callbacks = useRef({ onChange, onFocus, onRun, onRunAdvance })
  callbacks.current = { onChange, onFocus, onRun, onRunAdvance }
  const dark = useDarkMode()
  // Read inside the mount effect, which must not re-run when the theme flips.
  const darkRef = useRef(dark)
  darkRef.current = dark
  const themeCompartment = useRef(new Compartment()).current

  useEffect(() => {
    const parent = containerRef.current
    if (!parent) return
    const languageExtension = LANGUAGE_EXTENSIONS[language as NotebookLanguage]
    const extensions = [
      basicSetup,
      ...(languageExtension ? [languageExtension()] : []),
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
      // Held in a compartment so a light/dark toggle mid-session swaps the
      // palette in place; recreating the view would lose cursor and history.
      themeCompartment.of(darkRef.current ? oneDark : []),
    ]
    const view = new EditorView({
      state: EditorState.create({ doc: source, extensions }),
      parent,
    })
    viewRef.current = view
    return () => {
      viewRef.current = null
      view.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- editor is created once per language; source updates flow through the effect below
  }, [language])

  // External source changes (kernel restart, load) replace the document.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== source) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: source },
      })
    }
  }, [source])

  // Swap the palette when the site theme flips, without touching the document.
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: themeCompartment.reconfigure(dark ? oneDark : []),
    })
  }, [dark, themeCompartment])

  return <div ref={containerRef} className="cm-cell w-full" />
}
