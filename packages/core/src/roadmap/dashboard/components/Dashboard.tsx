"use client"

import { Skeleton } from "@workspace/ui/components/skeleton"

import { useMyProgress } from "../hooks/use-my-progress"
import { ProgressCard } from "./ProgressCard"

export function Dashboard() {
  const { data, loading } = useMyProgress()

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl border-4 border-black/10" />
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border-4 border-black bg-white p-10 text-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:border-zinc-800 dark:bg-zinc-900">
        <span className="text-4xl" aria-hidden>
          🎯
        </span>
        <p className="text-lg font-bold">Bắt đầu học ngay!</p>
        <a
          href="/roadmaps"
          className="rounded-md border-2 border-black bg-indigo-500 px-4 py-2 text-sm font-bold text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          Xem Roadmaps
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {data.map((progress) => (
        <ProgressCard key={progress.roadmapId} progress={progress} />
      ))}
    </div>
  )
}
