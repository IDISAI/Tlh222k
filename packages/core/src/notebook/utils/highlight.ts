// Static syntax highlighting for read-only code cells. Reuses the Lezer
// parsers that already ship with the CodeMirror editor deps, so viewer and
// editor highlight identically without a second highlighter dependency.
// Output is a token array rendered as React spans, never innerHTML.

import { classHighlighter, highlightCode } from "@lezer/highlight"
import { cppLanguage } from "@codemirror/lang-cpp"
import { goLanguage } from "@codemirror/lang-go"
import { javaLanguage } from "@codemirror/lang-java"
import { javascriptLanguage } from "@codemirror/lang-javascript"
import { pythonLanguage } from "@codemirror/lang-python"
import { rustLanguage } from "@codemirror/lang-rust"
import { juliaLanguage } from "@plutojl/lang-julia"

import type { NotebookLanguage } from "../kernel/languages"

export interface CodeToken {
  text: string
  /** "kw" | "str" | "com" | "num" | "fn" | "op" | "" */
  type: string
}

// Viewer uses the same language packages as the editable CodeMirror cells.
const PARSERS: Partial<
  Record<NotebookLanguage, typeof pythonLanguage.parser>
> = {
  python: pythonLanguage.parser,
  javascript: javascriptLanguage.parser,
  cpp: cppLanguage.parser,
  java: javaLanguage.parser,
  rust: rustLanguage.parser,
  go: goLanguage.parser,
  julia: juliaLanguage.parser,
}

/** classHighlighter emits "tok-*" class lists; fold them onto our palette. */
function tokenType(classes: string): string {
  if (!classes) return ""
  if (classes.includes("comment")) return "com"
  if (classes.includes("string")) return "str"
  if (classes.includes("keyword")) return "kw"
  if (classes.includes("number")) return "num"
  if (classes.includes("operator")) return "op"
  if (
    classes.includes("typeName") ||
    classes.includes("className") ||
    classes.includes("variableName2") // builtins (e.g. Python's print)
  ) {
    return "fn"
  }
  return ""
}

/** Tokenize source for a notebook language; unknown languages → plain text. */
export function tokenizeCode(code: string, language: string): CodeToken[] {
  const parser = PARSERS[language as NotebookLanguage]
  if (!parser) return [{ text: code, type: "" }]
  const tokens: CodeToken[] = []
  highlightCode(
    code,
    parser.parse(code),
    classHighlighter,
    (text, classes) => tokens.push({ text, type: tokenType(classes) }),
    () => tokens.push({ text: "\n", type: "" })
  )
  return tokens
}
