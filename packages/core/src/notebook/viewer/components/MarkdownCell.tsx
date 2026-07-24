"use client"

import type { ReactNode } from "react"
import Markdown, { type Components } from "react-markdown"

import { slugify } from "../../utils/slugify"

interface MarkdownCellProps {
  source: string
  /**
   * Anchor ids for this cell's headings, in document order, as allocated by
   * `NotebookService.extractToc`. Passing them is what makes two cells with the
   * same heading text land on different anchors — this component sees one cell
   * and cannot know what the rest of the notebook already used. Omitted, each
   * heading falls back to its own slug.
   */
  headingSlugs?: readonly string[]
}

// Collect visible text from react-markdown children (strings, arrays, and
// element children like inline <code>), for the fallback slug when the host
// supplies no ids.
function childText(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children)
  }
  if (Array.isArray(children)) return children.map(childText).join("")
  if (children && typeof children === "object" && "props" in children) {
    return childText(
      (children as { props: { children?: ReactNode } }).props.children
    )
  }
  return ""
}

/** Kaggle-Learn-style markdown rendering for tutorial prose. */
export function MarkdownCell({ source, headingSlugs }: MarkdownCellProps) {
  // Fresh on every render pass, deliberately: react-markdown renders headings
  // in document order within a pass, so walking the list in step is exact, and
  // StrictMode's second invocation starts from zero instead of continuing a
  // stale count the way a ref or a memo would.
  let next = 0
  const headingId = (children: ReactNode) =>
    headingSlugs?.[next++] ?? slugify(childText(children))

  const components: Components = {
    h1: ({ children }) => (
      <h1 id={headingId(children)} className="scroll-mt-20 text-3xl font-bold">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2
        id={headingId(children)}
        className="scroll-mt-20 text-2xl font-semibold"
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        id={headingId(children)}
        className="scroll-mt-20 text-xl font-semibold"
      >
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4
        id={headingId(children)}
        className="scroll-mt-20 text-lg font-semibold"
      >
        {children}
      </h4>
    ),
    p: ({ children }) => <p className="leading-7">{children}</p>,
    ul: ({ children }) => (
      <ul className="list-disc space-y-1 pl-6">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal space-y-1 pl-6">{children}</ol>
    ),
    a: ({ children, href }) => (
      <a
        href={href}
        className="font-semibold text-primary underline underline-offset-2"
      >
        {children}
      </a>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-muted pl-4 text-muted-foreground">
        {children}
      </blockquote>
    ),
    pre: ({ children }) => (
      <pre className="overflow-x-auto rounded-md bg-muted p-4 font-mono text-sm">
        {children}
      </pre>
    ),
    code: ({ className, children }) => {
      const isBlock = /language-/.test(className ?? "")
      if (isBlock) return <code className={className}>{children}</code>
      return (
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.875em]">
          {children}
        </code>
      )
    },
    img: ({ src, alt }) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={typeof src === "string" ? src : ""}
        alt={alt ?? ""}
        className="rounded-md"
      />
    ),
  }

  return (
    <div className="space-y-4 text-[15px]">
      <Markdown components={components}>{source}</Markdown>
    </div>
  )
}
