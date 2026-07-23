"use client"

import { useRef } from "react"
import { Search } from "lucide-react"

/**
 * The signature Airbnb search bar: white pill, the system's one shadow tier,
 * three hairline-divided segments, terminated by a 48px Rausch orb.
 *
 * Only the "What skill?" segment is wired — it filters the already-fetched
 * roadmaps by title on the client. The Where/Level segments have no backing
 * field on `Roadmap` yet, so they focus the live input rather than sitting
 * dead; they become real filters once the domain grows those columns.
 */
export function SearchPill({
  query,
  onQueryChange,
}: {
  query: string
  onQueryChange: (next: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const focusInput = () => inputRef.current?.focus()

  return (
    <div className="mx-auto flex h-16 max-w-[800px] items-center rounded-full border border-border bg-background pr-2 shadow-float">
      <button
        type="button"
        onClick={focusInput}
        className="flex-1 truncate rounded-full px-7 py-3 text-left text-[15px] text-muted-foreground"
      >
        Where are you learning?
      </button>

      <span className="h-7 w-px shrink-0 bg-border" />

      <label className="flex-1 px-7 py-3">
        <span className="sr-only">What skill?</span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          maxLength={200}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="What skill?"
          className="w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>

      <span className="h-7 w-px shrink-0 bg-border" />

      <button
        type="button"
        onClick={focusInput}
        className="flex-1 truncate rounded-full px-7 py-3 text-left text-[15px] text-muted-foreground"
      >
        Level
      </button>

      <button
        type="button"
        aria-label="Search"
        onClick={focusInput}
        className="ml-1 flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-[#e00b41]"
      >
        <Search className="size-5" />
      </button>
    </div>
  )
}
