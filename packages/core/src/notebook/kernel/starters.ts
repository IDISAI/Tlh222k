// The first cell a new notebook opens with, per language.
//
// Five of the seven kernels are REPLs: xeus-cling, IJava, evcxr, gophernotes
// and IJulia execute the cell as a sequence of statements, not as a program
// with an entry point. Writing `fn main() { … }` there defines a function that
// nothing ever calls, so the cell runs, reports success, and prints nothing —
// which reads as a broken notebook. Seeding the correct shape, with a line
// saying why, is cheaper than explaining it after the fact.

import type { NotebookLanguage } from "./languages"

export interface LanguageStarter {
  /** Source for the notebook's first code cell. */
  code: string
  /** Markdown shown above it: how this kernel runs what you type. */
  note: string
}

const REPL_NOTE =
  "Ô code chạy như **từng câu lệnh** trong một phiên làm việc, không phải một " +
  "file chương trình hoàn chỉnh. Viết thẳng câu lệnh — đừng bọc trong `main`, " +
  "vì sẽ không có ai gọi nó và ô sẽ chạy xong mà không in gì. Muốn giữ `main` " +
  "thì phải tự gọi nó ở dòng sau."

const DIRECT_NOTE =
  "Bấm ▶ để chạy ô này. Kết quả in ra hiện ngay bên dưới, và các ô chạy sau " +
  "vẫn nhớ biến của ô chạy trước."

export const STARTERS: Record<NotebookLanguage, LanguageStarter> = {
  python: {
    code: 'print("Xin chào!")\n',
    note: DIRECT_NOTE,
  },
  javascript: {
    code: 'console.log("Xin chào!")\n',
    note: DIRECT_NOTE,
  },
  cpp: {
    code: '#include <iostream>\n\nstd::cout << "Xin chào!" << std::endl;\n',
    note: REPL_NOTE,
  },
  java: {
    code: 'System.out.println("Xin chào!");\n',
    note: REPL_NOTE,
  },
  rust: {
    code: 'println!("Xin chào!");\n',
    note: REPL_NOTE,
  },
  go: {
    code: 'import "fmt"\n\nfmt.Println("Xin chào!")\n',
    note: REPL_NOTE,
  },
  julia: {
    code: 'println("Xin chào!")\n',
    note: REPL_NOTE,
  },
}

export function starterFor(
  language: string | undefined
): LanguageStarter | null {
  return STARTERS[language as NotebookLanguage] ?? null
}

/**
 * True when this source is still a starter (any language's) or blank — i.e.
 * nothing the author wrote. Switching language re-seeds only such cells, so a
 * real notebook is never overwritten by changing its kernel.
 */
export function isUntouchedSource(source: string): boolean {
  const trimmed = source.trim()
  if (trimmed === "") return true
  return Object.values(STARTERS).some(
    (starter) => starter.code.trim() === trimmed
  )
}

/** True when this markdown is one of the generated notes. */
export function isStarterNote(source: string): boolean {
  const trimmed = source.trim()
  return trimmed === REPL_NOTE || trimmed === DIRECT_NOTE
}
