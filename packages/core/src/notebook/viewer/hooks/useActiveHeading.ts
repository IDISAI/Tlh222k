"use client"

import { useEffect, useState } from "react"

/**
 * Scroll-spy: returns the slug of the deepest heading at or above the top of
 * the viewport (offset = sticky-header allowance), so the TOC can highlight
 * the section the reader is in.
 */
export function useActiveHeading(
  slugs: string[],
  offset = 96
): string | null {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    if (slugs.length === 0) {
      setActive(null)
      return
    }

    let frame = 0
    const update = () => {
      frame = 0
      let current = slugs[0] ?? null
      for (const slug of slugs) {
        const el = document.getElementById(slug)
        if (!el) continue
        if (el.getBoundingClientRect().top <= offset) current = slug
        else break
      }
      setActive(current)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
    // A joined key keeps the effect stable when callers pass a fresh array
    // with identical contents on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugs.join("\n"), offset])

  return active
}
