"use client"

import Markdown, { type Components } from "react-markdown"

// DESIGN_SYSTEM.md §6 markdown styling (neo-brutalist headings + code blocks).
const components: Components = {
  h1: ({ children }) => (
    <h1 className="flex items-center gap-2 border-b-4 border-black pb-2 text-2xl font-black dark:border-zinc-700">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-extrabold uppercase italic underline decoration-yellow-400 decoration-[3px] underline-offset-4">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-bold">{children}</h3>
  ),
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc space-y-1 pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 pl-5">{children}</ol>
  ),
  a: ({ children, href }) => (
    <a href={href} className="font-medium text-indigo-500 underline">
      {children}
    </a>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-xl border-2 border-black bg-zinc-950 p-4 font-mono text-sm text-emerald-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className ?? "")
    if (isBlock) return <code className={className}>{children}</code>
    return (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
        {children}
      </code>
    )
  },
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={typeof src === "string" ? src : ""}
      alt={alt ?? ""}
      className="rounded-lg border-2 border-black dark:border-zinc-700"
    />
  ),
}

/** Property 5: renders any valid markdown to HTML without throwing. */
export function MarkdownContent({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-3 text-sm">
      <Markdown components={components}>{markdown}</Markdown>
    </div>
  )
}
