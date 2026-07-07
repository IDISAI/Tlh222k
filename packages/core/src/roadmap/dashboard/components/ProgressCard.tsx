import type { FC } from "react"

import type { RoadmapProgress } from "../../types"
import { progressPercent } from "../../progress/utils/progress-formula"

export const ProgressCard: FC<{ progress: RoadmapProgress }> = ({ progress }) => {
  const pct = progressPercent(progress.doneCount, progress.totalCount)

  return (
    <div className="rounded-xl border-4 border-black bg-white p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.1)]">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xl font-extrabold uppercase italic">
          {progress.roadmapTitle}
        </h3>
        <span className="shrink-0 text-sm font-medium text-muted-foreground">
          {progress.doneCount}/{progress.totalCount} nodes done
        </span>
      </div>
      <div className="mt-4 h-4 w-full overflow-hidden rounded-full border-2 border-black bg-muted dark:border-zinc-700">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-right text-sm font-bold">{pct}%</p>
    </div>
  )
}
