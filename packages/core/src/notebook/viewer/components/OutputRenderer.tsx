"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import type { CellOutput, ErrorOutput, MimeBundle } from "../../types"
import { parseAnsi } from "../../utils/ansi"
import { sanitizeHtml } from "../../utils/sanitize-html"

// One output is truncated beyond this, behind a "Show more" affordance.
const MAX_OUTPUT_LINES = 5000
const MAX_OUTPUT_CHARS = 1_000_000

/** parseAnsi class names → Tailwind (viewer palette, light + dark). */
const ANSI_CLASS: Record<string, string> = {
  "ansi-bold": "font-bold",
  "ansi-black": "text-zinc-600 dark:text-zinc-400",
  "ansi-red": "text-red-600 dark:text-red-400",
  "ansi-green": "text-green-600 dark:text-green-400",
  "ansi-yellow": "text-yellow-600 dark:text-yellow-400",
  "ansi-blue": "text-blue-600 dark:text-blue-400",
  "ansi-magenta": "text-fuchsia-600 dark:text-fuchsia-400",
  "ansi-cyan": "text-cyan-600 dark:text-cyan-400",
  "ansi-white": "text-zinc-400 dark:text-zinc-300",
}

function ansiClasses(className: string): string {
  return className
    .split(" ")
    .map((c) => ANSI_CLASS[c] ?? "")
    .join(" ")
    .trim()
}

export interface OutputRendererProps {
  output: CellOutput
}

/** Renders one nbformat output: stream / execute_result / display_data / error. */
export function OutputRenderer({ output }: OutputRendererProps) {
  switch (output.kind) {
    case "stream":
      return (
        <TruncatablePre
          text={output.text}
          className={cn(
            output.name === "stderr" && "bg-amber-500/10 dark:bg-amber-500/15"
          )}
        />
      )
    case "error":
      return <ErrorOutputView output={output} />
    case "execute_result":
    case "display_data":
      return <MimeBundleView data={output.data} />
  }
}

/** Red-tinted traceback with ANSI colors, Jupyter-style. */
function ErrorOutputView({ output }: { output: ErrorOutput }) {
  const lines = useMemo(
    () =>
      // Traceback entries may themselves contain newlines.
      output.traceback.flatMap((entry) => entry.split("\n")),
    [output.traceback]
  )

  return (
    <pre className="overflow-x-auto rounded-md bg-red-500/10 p-3 font-mono text-sm leading-6 dark:bg-red-500/15">
      {lines.length > 0 ? (
        lines.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-words">
            {parseAnsi(line).map((span, j) =>
              span.className ? (
                <span key={j} className={ansiClasses(span.className)}>
                  {span.text}
                </span>
              ) : (
                span.text
              )
            )}
          </div>
        ))
      ) : (
        <span className="text-red-600 dark:text-red-400">
          {output.ename}: {output.evalue}
        </span>
      )}
    </pre>
  )
}

/** Rich output: html (sanitized) > image > plain text. */
function MimeBundleView({ data }: { data: MimeBundle }) {
  if (data.html !== undefined) {
    return <SanitizedHtml html={data.html} fallbackText={data.text} />
  }
  if (data.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`data:${data.image.mime};base64,${data.image.base64}`}
        alt="Cell output"
        className="max-w-full rounded-md"
      />
    )
  }
  if (data.text !== undefined) return <TruncatablePre text={data.text} />
  return null
}

/**
 * `text/html` outputs are untrusted (XSS vector) — sanitized client-side
 * after mount; the plain-text fallback covers SSR and the first paint.
 */
function SanitizedHtml({
  html,
  fallbackText,
}: {
  html: string
  fallbackText?: string
}) {
  const [clean, setClean] = useState<string | null>(null)
  useEffect(() => {
    setClean(sanitizeHtml(html))
  }, [html])

  if (clean === null) {
    return fallbackText !== undefined ? (
      <TruncatablePre text={fallbackText} />
    ) : null
  }
  return (
    <div
      className={cn(
        "overflow-x-auto text-sm",
        // pandas-style tables lose their <style> block in sanitization;
        // restyle them here instead.
        "[&_table]:border-collapse [&_table]:font-mono [&_table]:text-xs",
        "[&_th]:border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-right",
        "[&_td]:border [&_td]:px-2 [&_td]:py-1 [&_td]:text-right"
      )}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}

/** <pre> capped at MAX_OUTPUT_LINES/CHARS with a "Show more" toggle. */
function TruncatablePre({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)

  const { visible, hiddenLines } = useMemo(() => {
    let cut = text
    if (cut.length > MAX_OUTPUT_CHARS) cut = cut.slice(0, MAX_OUTPUT_CHARS)
    const lines = cut.split("\n")
    if (lines.length > MAX_OUTPUT_LINES) {
      cut = lines.slice(0, MAX_OUTPUT_LINES).join("\n")
    }
    if (cut.length === text.length) return { visible: text, hiddenLines: 0 }
    const hidden = text.split("\n").length - cut.split("\n").length
    return { visible: cut, hiddenLines: Math.max(hidden, 1) }
  }, [text])

  return (
    <div>
      <pre
        className={cn(
          "overflow-x-auto whitespace-pre-wrap break-words rounded-md p-3 font-mono text-sm leading-6",
          className
        )}
      >
        {expanded ? text : visible}
      </pre>
      {hiddenLines > 0 && !expanded && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ml-3"
          onClick={() => setExpanded(true)}
        >
          Show {hiddenLines} more lines
        </Button>
      )}
    </div>
  )
}
