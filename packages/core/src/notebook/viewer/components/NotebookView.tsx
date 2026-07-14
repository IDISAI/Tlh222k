"use client"

import { useMemo } from "react"
import { cn } from "@workspace/ui/lib/utils"

import type { Notebook } from "../../types"
import { NotebookService } from "../../notebook.service"
import { useActiveHeading } from "../hooks/useActiveHeading"
import { CellRenderer } from "./CellRenderer"
import { StartExerciseCard } from "./StartExerciseCard"
import { TableOfContents } from "./TableOfContents"

const service = new NotebookService()

export interface NotebookViewProps {
  notebook: Notebook
  /**
   * When set (with `exerciseTitle`), the floating "Your turn" card renders
   * and this fires on "Start Exercise" — the page owns the tab switch.
   */
  onStartExercise?: () => void
  exerciseTitle?: string
  className?: string
}

/**
 * Read-only Kaggle-Learn-style notebook: rendered cells + sticky scroll-spy
 * TOC. Shared by the web Tutorial tab today and any future read views.
 */
export function NotebookView({
  notebook,
  onStartExercise,
  exerciseTitle,
  className,
}: NotebookViewProps) {
  const toc = useMemo(() => service.extractToc(notebook), [notebook])
  const slugs = useMemo(() => toc.map((e) => e.slug), [toc])
  const activeSlug = useActiveHeading(slugs)

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-6xl gap-10 px-4 py-8",
        className
      )}
    >
      <article className="min-w-0 flex-1 space-y-8">
        {notebook.cells.map((cell) => (
          <CellRenderer
            key={cell.id}
            cell={cell}
          />
        ))}
      </article>

      {toc.length > 0 && (
        <aside className="sticky top-24 hidden max-h-[calc(100svh-8rem)] w-60 shrink-0 self-start overflow-y-auto lg:block">
          <TableOfContents entries={toc} activeSlug={activeSlug} />
        </aside>
      )}

      {onStartExercise && exerciseTitle && (
        <StartExerciseCard
          exerciseTitle={exerciseTitle}
          onStart={onStartExercise}
        />
      )}
    </div>
  )
}
