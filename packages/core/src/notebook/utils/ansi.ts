// Minimal ANSI SGR parser for Jupyter tracebacks (no dependency). Jupyter
// emits 16/256-color escape codes in error tracebacks; we map them to a small
// palette of CSS classes the OutputRenderer styles.

export interface AnsiSpan {
  text: string
  /** e.g. "ansi-red" | "ansi-green" | "ansi-bold ansi-cyan" | "" */
  className: string
}

const COLOR_NAMES: Record<number, string> = {
  30: "black",
  31: "red",
  32: "green",
  33: "yellow",
  34: "blue",
  35: "magenta",
  36: "cyan",
  37: "white",
}

// 256-color codes Jupyter/IPython commonly uses in tracebacks.
const EXTENDED_COLOR_NAMES: Record<number, string> = {
  1: "red",
  2: "green",
  3: "yellow",
  4: "blue",
  5: "magenta",
  6: "cyan",
  9: "red",
  10: "green",
  11: "yellow",
  12: "blue",
  14: "cyan",
}

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\[([0-9;]*)m/g

/** Split a line containing ANSI SGR codes into styled spans. */
export function parseAnsi(input: string): AnsiSpan[] {
  const spans: AnsiSpan[] = []
  let bold = false
  let color: string | null = null
  let lastIndex = 0

  const push = (text: string) => {
    if (!text) return
    const classes: string[] = []
    if (bold) classes.push("ansi-bold")
    if (color) classes.push(`ansi-${color}`)
    spans.push({ text, className: classes.join(" ") })
  }

  for (const match of input.matchAll(ANSI_PATTERN)) {
    push(input.slice(lastIndex, match.index))
    lastIndex = match.index + match[0].length

    const codes = (match[1] ?? "")
      .split(";")
      .map((c) => (c === "" ? 0 : Number(c)))
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i]!
      if (code === 0) {
        bold = false
        color = null
      } else if (code === 1) {
        bold = true
      } else if (code === 22) {
        bold = false
      } else if (code === 39) {
        color = null
      } else if (COLOR_NAMES[code]) {
        color = COLOR_NAMES[code]!
      } else if (code >= 90 && code <= 97) {
        color = COLOR_NAMES[code - 60]!
      } else if (code === 38 && codes[i + 1] === 5) {
        const ext = codes[i + 2]
        color = (ext !== undefined && EXTENDED_COLOR_NAMES[ext]) || color
        i += 2
      }
    }
  }
  push(input.slice(lastIndex))
  return spans
}

/** Strip all ANSI escape codes (for plain-text fallbacks). */
export function stripAnsi(input: string): string {
  return input.replace(ANSI_PATTERN, "")
}
