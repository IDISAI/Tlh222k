"use client"

// The notebook page frame, defined by the web viewer and reused by the admin
// editor so the two cannot drift: table of contents on the left, notebook in
// the middle, execution visualization on the right.

import type { ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"

import type { TocEntry } from "../types"
import { TableOfContents } from "../viewer/components/TableOfContents"

export function NotebookWorkspace({
  toc,
  activeSlug,
  panel,
  floating,
  stickyClassName = "top-24",
  children,
}: {
  toc: TocEntry[]
  activeSlug?: string | null
  /** Right column; also widens the layout. Omit to render notebook-only. */
  panel?: ReactNode
  /** Overlays anchored to the page, e.g. the "your turn" card. */
  floating?: ReactNode
  /**
   * Offset for the sticky columns. The viewer sticks below the site header;
   * the editor scrolls inside its own pane, which starts below its toolbar.
   */
  stickyClassName?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full gap-8 px-4 py-6",
        panel ? "max-w-7xl" : "max-w-6xl"
      )}
    >
      {/* TOC sidebar — left column, scroll-spy, sticky, hidden on small screens */}
      {toc.length > 0 && (
        <aside
          className={cn(
            "sticky hidden max-h-[calc(100svh-8rem)] w-56 shrink-0 self-start overflow-y-auto lg:block",
            stickyClassName
          )}
        >
          <TableOfContents entries={toc} activeSlug={activeSlug} />
        </aside>
      )}

      <div className="min-w-0 flex-1">{children}</div>

      {/* Visualization panel — right column at lg, full-screen overlay below */}
      {panel && (
        <aside
          className={cn(
            "fixed inset-0 z-50 overflow-y-auto bg-background p-4 lg:sticky lg:z-auto lg:max-h-[calc(100svh-8rem)] lg:w-[30rem] lg:shrink-0 lg:self-start lg:overflow-visible lg:p-0",
            stickyClassName
          )}
        >
          {panel}
        </aside>
      )}

      {floating}
    </div>
  )
}
