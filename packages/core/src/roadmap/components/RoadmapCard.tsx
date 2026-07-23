"use client"

import type { FC } from "react"
import { useEffect, useState } from "react"
import { Heart } from "lucide-react"

import type { Roadmap } from "../types"
import { truncateDescription } from "../utils/truncate-description"

const SAVED_KEY = "lh222k:saved-roadmaps"

function readSaved(): string[] {
  try {
    const raw = window.localStorage.getItem(SAVED_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

/**
 * Airbnb-style property card for a roadmap block. Photo-first: a 16:10 cover
 * with `radius-md` clipping and a heart save toggle floating top-right, then
 * the meta stack beneath. LEGO: a card IS a block, so it links by the block's
 * NODE id (`roadmap.id`) — not the slug, which an orphaned container roadmap
 * can shadow. Root-absolute <a> works from any zone.
 *
 * The save state is per-browser (`localStorage`); there is no saved-roadmaps
 * column on the backend yet.
 */
export const RoadmapCard: FC<{ roadmap: Roadmap }> = ({ roadmap }) => {
  const [saved, setSaved] = useState(false)

  // Read after mount so the server-rendered markup and first client render
  // agree — localStorage is unavailable during SSR.
  useEffect(() => {
    setSaved(readSaved().includes(roadmap.id))
  }, [roadmap.id])

  const toggleSaved = () => {
    const next = !saved
    setSaved(next)
    try {
      const current = readSaved().filter((id) => id !== roadmap.id)
      window.localStorage.setItem(
        SAVED_KEY,
        JSON.stringify(next ? [...current, roadmap.id] : current)
      )
    } catch {
      /* private mode / quota — the in-memory toggle still applies */
    }
  }

  const description = truncateDescription(roadmap.description, 90)

  return (
    <article className="group relative">
      <div className="relative aspect-[16/10] overflow-hidden rounded-[14px] bg-accent">
        {roadmap.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={roadmap.thumbnailUrl}
            alt={roadmap.title}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span
            className="flex size-full items-center justify-center text-4xl"
            aria-hidden
          >
            🗺️
          </span>
        )}

        <button
          type="button"
          onClick={toggleSaved}
          aria-pressed={saved}
          aria-label={saved ? `Unsave ${roadmap.title}` : `Save ${roadmap.title}`}
          className="absolute right-3 top-3 z-20 flex size-8 items-center justify-center rounded-full"
        >
          <Heart
            className="size-6 stroke-2 text-white"
            fill={saved ? "#ff385c" : "rgba(0,0,0,.5)"}
          />
        </button>
      </div>

      <div className="pt-3">
        <h3 className="mb-[3px] text-base font-semibold">
          <a
            href={`/roadmap/${roadmap.id}`}
            className="after:absolute after:inset-0 after:content-['']"
          >
            {roadmap.title}
          </a>
        </h3>
        <p className="text-sm text-muted-foreground">
          {roadmap.nodeCount} {roadmap.nodeCount === 1 ? "node" : "nodes"}
        </p>
        {description ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </article>
  )
}
