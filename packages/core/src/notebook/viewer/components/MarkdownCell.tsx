"use client"

import { useMemo } from "react"
import Markdown, { type Components } from "react-markdown"

import { createSlugger } from "../../utils/slugify"

// Mirrors NotebookService internals — keep in sync if the pattern changes.
const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/gm
function stripMd(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .trim()
}

interface MarkdownCellProps {
  source: string
}

/** Kaggle-Learn-style markdown rendering for tutorial prose. */
export function MarkdownCell({ source }: MarkdownCellProps) {
  // Derive heading anchor IDs directly from source with a per-cell slugger —
  // the same algorithm extractToc uses — so IDs are identical on server and
  // client regardless of prop serialization across the RSC boundary.
  const slugs = useMemo(() => {
    const slug = createSlugger()
    const result: string[] = []
    for (const match of source.matchAll(HEADING_RE)) {
      result.push(slug(stripMd(match[2]!)))
    }
    return result
  }, [source])

  let headingIndex = 0
  const nextSlug = () => slugs[headingIndex++]

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
