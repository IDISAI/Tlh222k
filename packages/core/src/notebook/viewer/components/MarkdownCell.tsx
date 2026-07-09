"use client"

import Markdown, { type Components } from "react-markdown"

import type { TocEntry } from "../../types"

interface MarkdownCellProps {
  source: string
  /** TOC entries for this cell's headings, in source order (anchor ids). */
  headings?: TocEntry[]
}

/** Kaggle-Learn-style markdown rendering for tutorial prose. */
export function MarkdownCell({ source, headings = [] }: MarkdownCellProps) {
  // Headings render in source order, so a simple queue assigns each rendered
  // heading the slug the service computed for it (keeps TOC anchors in sync).
  let headingIndex = 0
  const nextSlug = () => headings[headingIndex++]?.slug

  const components: Components = {
    h1: ({ children }) => (
      <h1 id={nextSlug()} className="scroll-mt-20 text-3xl font-bold">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 id={nextSlug()} className="scroll-mt-20 text-2xl font-semibold">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 id={nextSlug()} className="scroll-mt-20 text-xl font-semibold">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 id={nextSlug()} className="scroll-mt-20 text-lg font-semibold">
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
