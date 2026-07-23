"use client"

import { useMemo } from "react"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { useRoadmap } from "../hooks/use-roadmap"
import { RoadmapCard } from "./RoadmapCard"

/** Case- and accent-insensitive so "dev" matches "Dév" and "lập" matches "lap". */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

/**
 * Airbnb marketplace grid: 4 columns on desktop, dropping to 2 below 1128px
 * and 1 below 744px. Columns are dropped, never reflowed. Loading, error and
 * empty states are flat panels — the system's one shadow tier is reserved for
 * floated surfaces, not page content.
 */
export function RoadmapList({
  query = "",
  fieldId = null,
}: {
  query?: string
  /** `null` means no label filter — show the whole catalogue. */
  fieldId?: string | null
}) {
  const { data, loading, error, retry } = useRoadmap()

  // Both filters run on already-fetched data: the payload is small and the tab
  // strip is clicked often, so a round trip per tab would be pure latency.
  const visible = useMemo(() => {
    if (!data) return []
    const needle = fold(query.trim())
    return data.filter((roadmap) => {
      if (needle && !fold(roadmap.title).includes(needle)) return false
      if (fieldId && !roadmap.fields.some((f) => f.id === fieldId)) return false
      return true
    })
  }, [data, query, fieldId])

  if (loading) {
    return (
      <div
        aria-busy="true"
        className="grid grid-cols-1 gap-x-4 gap-y-7 min-[744px]:grid-cols-2 min-[1128px]:grid-cols-4"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[16/10] rounded-[14px]" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[14px] border border-border p-10 text-center">
        <p className="text-base font-semibold">Something went wrong</p>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t load the roadmaps.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="h-12 rounded-lg bg-primary px-6 text-base font-medium text-primary-foreground transition-colors hover:bg-[#e00b41] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          Try again
        </button>
      </div>
    )
  }

  if (visible.length === 0) {
    // "Nothing matched" and "nothing exists" are different problems: the first
    // is fixed by clearing a filter, the second by waiting for new content.
    const filtered = Boolean(query.trim() || fieldId)
    return (
      <div className="flex flex-col items-center gap-2 rounded-[14px] border border-border p-10 text-center">
        <p className="text-base font-semibold">
          {filtered ? "No roadmaps match your filters" : "No roadmaps yet"}
        </p>
        <p className="text-sm text-muted-foreground">
          {filtered
            ? "Try another keyword or category."
            : "Check back soon — new paths are published regularly."}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-7 min-[744px]:grid-cols-2 min-[1128px]:grid-cols-4">
      {visible.map((roadmap) => (
        <RoadmapCard key={roadmap.id} roadmap={roadmap} />
      ))}
    </div>
  )
}
