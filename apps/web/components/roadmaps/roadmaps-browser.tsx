"use client"

import { useLayoutEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import gsap from "gsap"
import { RoadmapList } from "@workspace/core"

import { CategoryStrip } from "@/components/roadmaps/category-strip"
import { SearchPill } from "@/components/roadmaps/search-pill"
import { useMediaQuery } from "@/hooks/use-media-query"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"

// three.js is ~150KB and purely decorative, so it must never sit on the
// critical path: no SSR, and the hero renders complete without it.
const HeroScene = dynamic(
  () => import("@/components/roadmaps/hero-scene").then((m) => m.HeroScene),
  { ssr: false }
)

/**
 * Owns the discovery page's client state so the route itself stays a server
 * component. The search query is lifted here because the pill and the grid are
 * siblings; filtering runs on already-fetched data, no extra request.
 */
export function RoadmapsBrowser() {
  const [query, setQuery] = useState("")
  const [fieldId, setFieldId] = useState<string | null>(null)
  const heroRef = useRef<HTMLElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  // The headline runs ~860px at its 34px size, so the shapes only have a clear
  // band to sit in once the viewport is comfortably wider than that. 1128px is
  // the design system's desktop breakpoint; below it the headline eats the
  // full width and the shapes land on the text. Gating the render (not just
  // hiding with CSS) also keeps three.js off phones and tablets entirely.
  const showScene = useMediaQuery("(min-width: 1128px)")

  // Layout effect so the pre-animation state is committed before paint —
  // with useEffect the heading flashes at its final position for one frame.
  useLayoutEffect(() => {
    if (reducedMotion) return
    const ctx = gsap.context(() => {
      // Kept deliberately short and near-parallel: the search pill is the
      // page's primary control, so it must not be faded out from under the
      // visitor. The whole entrance is done inside ~0.5s.
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from("[data-hero-title]", { y: 20, opacity: 0, duration: 0.45 })
        .from("[data-hero-search]", { y: 12, opacity: 0, duration: 0.35 }, "-=0.3")
    }, heroRef)
    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <>
      <section
        ref={heroRef}
        className="relative isolate px-5 pb-8 pt-20 text-center md:px-10"
      >
        {showScene ? <HeroScene /> : null}
        <div className="mx-auto max-w-[1280px]">
          <h1
            data-hero-title
            className="mb-8 text-[28px] font-bold leading-tight md:text-[34px]"
          >
            Inspiration for your next learning journey
          </h1>
          <div data-hero-search>
            <SearchPill query={query} onQueryChange={setQuery} />
          </div>
        </div>
      </section>

      <div className="mt-6">
        <CategoryStrip selectedFieldId={fieldId} onSelect={setFieldId} />
      </div>

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-5 pb-16 pt-8 md:px-10">
        <RoadmapList query={query} fieldId={fieldId} />
      </main>
    </>
  )
}
