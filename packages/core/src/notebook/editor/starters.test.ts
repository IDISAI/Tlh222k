import { describe, expect, it } from "vitest"

import { createCell, emptyNotebook, reseedForLanguage } from "./editor.service"
import { STARTERS } from "../kernel/starters"

describe("emptyNotebook seeding", () => {
  it("opens a new notebook on a cell that actually prints", () => {
    for (const language of Object.keys(STARTERS) as (keyof typeof STARTERS)[]) {
      const notebook = emptyNotebook("Bài mới", language)
      const code = notebook.cells.filter((cell) => cell.cellType === "code")

      expect(notebook.language).toBe(language)
      expect(code).toHaveLength(1)
      expect(code[0]!.source).toBe(STARTERS[language].code)
    }
  })

  it("calls main, because a REPL kernel will not call it for you", () => {
    // The starters are written in each language's normal shape, `main` and all,
    // so nobody learns a syntax they would have to unlearn. That shape prints
    // nothing on its own here: defining `main` is not running it. Every starter
    // that declares one must therefore also invoke it on a later line.
    for (const [language, starter] of Object.entries(STARTERS)) {
      if (!/\bmain\b/.test(starter.code)) continue
      const lines = starter.code.trimEnd().split("\n")
      const last = lines[lines.length - 1]!.trim()
      expect(last, `${language} never calls main`).toMatch(/main\(/)
    }
  })

  it("writes each language in its own conventional form", () => {
    // Enough of the real shape to be worth copying into a file, per language.
    expect(STARTERS.go.code).toContain("package main")
    expect(STARTERS.cpp.code).toContain("#include <iostream>")
    expect(STARTERS.cpp.code).toContain("return 0;")
    expect(STARTERS.java.code).toContain("public class Main")
    expect(STARTERS.java.code).toContain("String[] args")
    expect(STARTERS.rust.code).toContain("fn main()")
    expect(STARTERS.julia.code).toContain("function main()")
    expect(STARTERS.python.code).toContain('if __name__ == "__main__":')
  })

  it("explains the kernel above the first cell", () => {
    const notebook = emptyNotebook("Bài mới", "rust")
    const markdown = notebook.cells.filter(
      (cell) => cell.cellType === "markdown"
    )

    expect(markdown).toHaveLength(2)
    expect(markdown[0]!.source).toContain("# Bài mới")
    expect(markdown[1]!.source).toContain("main")
    expect(markdown[1]!.source).toContain("cú pháp chuẩn")
  })

  it("still defaults to Python, as the create form expects", () => {
    expect(emptyNotebook().language).toBe("python")
  })

  it("writes the matching kernelspec, not always python3", () => {
    expect(emptyNotebook("x", "julia").metadata).toMatchObject({
      kernelspec: { name: "julia", language: "julia" },
      language_info: { name: "julia" },
    })
  })
})

describe("reseedForLanguage", () => {
  it("swaps the starter when the author has written nothing", () => {
    const cells = emptyNotebook("Bài mới", "python").cells

    const next = reseedForLanguage(cells, "rust")

    expect(next.find((cell) => cell.cellType === "code")!.source).toBe(
      STARTERS.rust.code
    )
    expect(next[1]!.source).toBe(STARTERS.rust.note)
  })

  it("gives the re-seeded cell a new id so no stale output clings to it", () => {
    const cells = emptyNotebook("Bài mới", "python").cells
    const before = cells.find((cell) => cell.cellType === "code")!

    const after = reseedForLanguage(cells, "julia").find(
      (cell) => cell.cellType === "code"
    )!

    expect(after.id).not.toBe(before.id)
  })

  it("leaves a notebook with real work in it alone", () => {
    const cells = [
      createCell("markdown", "# Bài của tôi\n"),
      createCell("code", "x = tinh_toan(42)\n"),
    ]

    expect(reseedForLanguage(cells, "rust")).toEqual(cells)
  })

  it("treats a cell that has run as real work, even if it looks like a starter", () => {
    const ran = createCell("code", STARTERS.python.code)
    ran.outputs = [{ kind: "stream", name: "stdout", text: "Xin chào!\n" }]

    expect(reseedForLanguage([ran], "rust")).toEqual([ran])
  })

  it("leaves a multi-cell notebook alone", () => {
    const cells = [
      createCell("code", STARTERS.python.code),
      createCell("code", ""),
    ]

    expect(reseedForLanguage(cells, "go")).toEqual(cells)
  })
})
