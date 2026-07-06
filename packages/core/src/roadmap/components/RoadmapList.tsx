"use client"

import { Skeleton } from "@workspace/ui/components/skeleton"

import { useRoadmap } from "../hooks/use-roadmap"
import { RoadmapCard } from "./RoadmapCard"

export function RoadmapList() {
  const { data, loading, error, retry } = useRoadmap()

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl border-4 border-black/10" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border-4 border-black bg-white p-10 text-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-lg font-bold">⚠ Không thể tải dữ liệu</p>
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-md border-2 border-black bg-indigo-500 px-4 py-2 text-sm font-bold text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          Thử lại
        </button>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border-4 border-black bg-white p-10 text-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:border-zinc-800 dark:bg-zinc-900">
        <span className="text-4xl" aria-hidden>
          📭
        </span>
        <p className="text-lg font-bold">Chưa có roadmap nào</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {data.map((roadmap) => (
        <RoadmapCard key={roadmap.id} roadmap={roadmap} />
      ))}
    </div>
  )
}
