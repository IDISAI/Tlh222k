// Tiny regex tokenizer for Python code cells — enough for the Kaggle-style
// viewer (keywords / strings / comments / numbers / builtins) without pulling
// a highlighter dependency. Output is a token array rendered as React spans,
// never innerHTML.

export interface CodeToken {
  text: string
  /** "kw" | "str" | "com" | "num" | "fn" | "op" | "" */
  type: string
}

const KEYWORDS = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break",
  "class", "continue", "def", "del", "elif", "else", "except", "finally",
  "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal",
  "not", "or", "pass", "raise", "return", "try", "while", "with", "yield",
])

const BUILTINS = new Set([
  "print", "len", "range", "int", "float", "str", "list", "dict", "set",
  "tuple", "type", "input", "round", "abs", "min", "max", "sum", "sorted",
  "enumerate", "zip", "open", "isinstance", "super", "map", "filter",
])

const TOKEN_PATTERN = new RegExp(
  [
    /(#[^\n]*)/.source, // 1 comment
    /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/
      .source, // 2 string
    /\b(\d+\.?\d*(?:[eE][+-]?\d+)?)\b/.source, // 3 number
    /\b([A-Za-z_][A-Za-z0-9_]*)\b/.source, // 4 identifier
    /([+\-*/%=<>!&|^~@]+)/.source, // 5 operator
  ].join("|"),
  "g"
)

export function tokenizePython(code: string): CodeToken[] {
  const tokens: CodeToken[] = []
  let lastIndex = 0

  for (const match of code.matchAll(TOKEN_PATTERN)) {
    if (match.index > lastIndex) {
      tokens.push({ text: code.slice(lastIndex, match.index), type: "" })
    }
    lastIndex = match.index + match[0].length

    const [, comment, string, number, ident, op] = match
    if (comment !== undefined) tokens.push({ text: comment, type: "com" })
    else if (string !== undefined) tokens.push({ text: string, type: "str" })
    else if (number !== undefined) tokens.push({ text: number, type: "num" })
    else if (ident !== undefined) {
      if (KEYWORDS.has(ident)) tokens.push({ text: ident, type: "kw" })
      else if (BUILTINS.has(ident)) tokens.push({ text: ident, type: "fn" })
      else tokens.push({ text: ident, type: "" })
    } else if (op !== undefined) tokens.push({ text: op, type: "op" })
  }
  if (lastIndex < code.length) {
    tokens.push({ text: code.slice(lastIndex), type: "" })
  }
  return tokens
}
