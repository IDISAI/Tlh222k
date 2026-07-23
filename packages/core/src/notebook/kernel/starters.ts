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
  "Chương trình được viết đúng cú pháp chuẩn của ngôn ngữ này — có hàm `main` " +
  "như khi bạn viết ra file. Khác biệt duy nhất: kernel chạy ô code như **từng " +
  "câu lệnh** chứ không khởi động một chương trình, nên không có ai tự gọi " +
  "`main`. Dòng cuối gọi nó; bỏ dòng đó thì ô vẫn chạy xong nhưng không in gì."

const DIRECT_NOTE =
  "Bấm ▶ để chạy ô này. Kết quả in ra hiện ngay bên dưới, và các ô chạy sau " +
  "vẫn nhớ biến của ô chạy trước."

export const STARTERS: Record<NotebookLanguage, LanguageStarter> = {
  python: {
    code:
      "def main():\n" +
      '    print("Xin chào!")\n\n\n' +
      'if __name__ == "__main__":\n' +
      "    main()\n",
    note: DIRECT_NOTE,
  },
  javascript: {
    code:
      "function main() {\n" +
      '  console.log("Xin chào!")\n' +
      "}\n\n" +
      "main()\n",
    note: DIRECT_NOTE,
  },
  cpp: {
    code:
      "#include <iostream>\n\n" +
      "int main() {\n" +
      '    std::cout << "Xin chào!" << std::endl;\n' +
      "    return 0;\n" +
      "}\n\n" +
      "main();\n",
    note: REPL_NOTE,
  },
  java: {
    code:
      "public class Main {\n" +
      "    public static void main(String[] args) {\n" +
      '        System.out.println("Xin chào!");\n' +
      "    }\n" +
      "}\n\n" +
      "Main.main(new String[]{});\n",
    note: REPL_NOTE,
  },
  rust: {
    code:
      "fn main() {\n" + '    println!("Xin chào!");\n' + "}\n\n" + "main();\n",
    note: REPL_NOTE,
  },
  go: {
    code:
      "package main\n\n" +
      'import "fmt"\n\n' +
      "func main() {\n" +
      '    fmt.Println("Xin chào!")\n' +
      "}\n\n" +
      "main()\n",
    note: REPL_NOTE,
  },
  julia: {
    code:
      "function main()\n" +
      '    println("Xin chào!")\n' +
      "end\n\n" +
      "main()\n",
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
