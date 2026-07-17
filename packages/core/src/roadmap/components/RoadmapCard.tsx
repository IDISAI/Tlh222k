import type { FC } from "react"

import type { Roadmap } from "../types"
import { truncateDescription } from "../utils/truncate-description"

/** Bento card for a roadmap. Root-absolute <a> so it works from any zone. */
export const RoadmapCard: FC<{ roadmap: Roadmap }> = ({ roadmap }) => {
  return (
    <a
      href={`/roadmap/${roadmap.slug}`}
      className="block overflow-hidden rounded-xl border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 hover:-translate-y-1 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.1)]"
    >
      <div className="flex aspect-video w-full items-center justify-center overflow-hidden border-b-4 border-black bg-muted dark:border-zinc-800">
        {roadmap.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={roadmap.thumbnailUrl}
            alt={roadmap.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-4xl text-muted-foreground" aria-hidden>
            🗺️
          </span>
        )}
      </div>
      <div className="p-5">
        <h3 className="text-xl font-extrabold uppercase italic">
          {roadmap.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {truncateDescription(roadmap.description)}
        </p>
        <p className="mt-3 text-xs font-medium text-muted-foreground">
          {roadmap.nodeCount} chủ đề
        </p>
      </div>
    </a>
  )
}
