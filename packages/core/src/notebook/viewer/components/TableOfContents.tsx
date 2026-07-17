"use client"

import { cn } from "@workspace/ui/lib/utils"

import type { TocEntry } from "../../types"

export interface TableOfContentsProps {
  entries: TocEntry[]
  activeSlug?: string | null
  className?: string
}

/** Sticky sidebar TOC; the active section carries a left-bar highlight. */
export function TableOfContents({
  entries,
  activeSlug,
  className,
}: TableOfContentsProps) {
  if (entries.length === 0) return null
  const minLevel = Math.min(...entries.map((e) => e.level))

  const scrollTo = (slug: string) => {
    document.getElementById(slug)?.scrollIntoView({ behavior: "smooth" })
    history.replaceState(null, "", `#${slug}`)
  }

  return (
    <nav aria-label="Table of contents" className={cn("text-sm", className)}>
      <ul>
        {entries.map((entry) => {
          const active = entry.slug === activeSlug
          return (
            <li key={entry.slug}>
              <a
                href={`#${entry.slug}`}
                onClick={(e) => {
                  e.preventDefault()
                  scrollTo(entry.slug)
                }}
                aria-current={active ? "location" : undefined}
                style={{
                  paddingLeft: `${(entry.level - minLevel) * 12 + 12}px`,
                }}
                className={cn(
                  "block truncate border-l-2 py-1.5 transition-colors",
                  active
                    ? "border-foreground font-semibold text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {entry.text}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
