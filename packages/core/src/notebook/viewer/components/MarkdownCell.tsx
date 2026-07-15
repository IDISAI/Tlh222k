"use client"

import type { ReactNode } from "react"
import Markdown, { type Components } from "react-markdown"

import { slugify } from "../../utils/slugify"

interface MarkdownCellProps {
  source: string
}

// Collect visible text from react-markdown children (strings, arrays, and
// element children like inline <code>) so the anchor id derives purely from
// the heading itself — no cross-heading counter that could drift between the
// server and StrictMode's double-invoked client render.
// ponytail: no duplicate-suffix dedup here; matches extractToc for the common
// one-heading-per-cell layout. Add a per-cell slugger if a cell ever ships two
// headings with identical text.
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

const headingId = (children: ReactNode) => slugify(childText(children))

/** Kaggle-Learn-style markdown rendering for tutorial prose. */
export function MarkdownCell({ source }: MarkdownCellProps) {
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
      <h3 id={headingId(children)} className="scroll-mt-20 text-xl font-semibold">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 id={headingId(children)} className="scroll-mt-20 text-lg font-semibold">
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
