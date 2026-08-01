"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import Link from "next/link"
import gsap from "gsap"
import { ArrowRight, ScanLine } from "lucide-react"
import {
  fieldRoadmapCta,
  RoadmapService,
  type Field,
  useFields,
  useRoadmap,
} from "@workspace/core"
import { cn } from "@workspace/ui/lib/utils"
import { AuthHeader } from "@/components/auth-header"

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1800&q=85"

/** Full-viewport public landing page. Fields are the only public entry point. */
export function FieldExplorer() {
  const { fields, loading } = useFields()
  const { data: roadmaps } = useRoadmap()
  const service = useMemo(() => new RoadmapService(), [])
  const visible = useMemo(
    () => fields.filter((field) => field.publishStatus === "PUBLISHED"),
    [fields]
  )
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [directField, setDirectField] = useState<Field | null>(null)
  const [background, setBackground] = useState<Field | null>(null)
  const [outgoingBackground, setOutgoingBackground] = useState<Field | null>(
    null
  )
  const [transitionOrigin, setTransitionOrigin] = useState("50% 50%")
  const [reducedMotion, setReducedMotion] = useState(false)
  const backdropRef = useRef<HTMLDivElement>(null)
  const active =
    visible.find((field) => field.slug === activeSlug) ??
    directField ??
    visible[0]

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("field")
    if (slug && visible.some((field) => field.slug === slug))
      setActiveSlug(slug)
    else if (slug) setActiveSlug(slug)
  }, [visible])

  useEffect(() => {
    if (!activeSlug || visible.some((field) => field.slug === activeSlug)) {
      setDirectField(null)
      return
    }
    let cancelled = false
    void service
      .fieldBySlug(activeSlug)
      .then((field) => {
        if (!cancelled) setDirectField(field)
      })
      .catch(() => {
        if (!cancelled) setDirectField(null)
      })
    return () => {
      cancelled = true
    }
  }, [activeSlug, service, visible])

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    if (!active) return
    if (!background) {
      setBackground(active)
      return
    }
    if (background.id === active.id) return

    if (reducedMotion) {
      setOutgoingBackground(null)
      setBackground(active)
      return
    }

    // Keep the current image painted while the next image is fetched. A field
    // image must never reveal an empty/half-painted scene during a transition.
    let cancelled = false
    let transitionTimer: number | undefined
    const nextImage = new Image()
    const reveal = () => {
      if (cancelled) return
      setOutgoingBackground(background)
      setBackground(active)
      transitionTimer = window.setTimeout(
        () => setOutgoingBackground(null),
        760
      )
    }
    nextImage.onload = reveal
    nextImage.onerror = reveal
    nextImage.src = active.imageUrl || FALLBACK_IMAGE
    return () => {
      cancelled = true
      if (transitionTimer) window.clearTimeout(transitionTimer)
    }
  }, [active, background, reducedMotion])

  useEffect(() => {
    const layer = backdropRef.current
    if (!layer || reducedMotion) return
    const context = gsap.context(() => {
      gsap.fromTo(
        layer,
        { opacity: 0.35, scale: 1.09 },
        {
          opacity: 1,
          scale: 1.035,
          duration: 0.76,
          ease: "power3.out",
          overwrite: true,
        }
      )
    }, layer)
    return () => context.revert()
  }, [background?.id, reducedMotion])

  const select = useCallback((slug: string, origin = "50% 50%") => {
    setTransitionOrigin(origin)
    setActiveSlug(slug)
    setDirectField(null)
    const url = new URL(window.location.href)
    url.searchParams.set("field", slug)
    window.history.replaceState(null, "", url)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !visible.length ||
        (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
      )
        return
      const currentIndex = Math.max(
        visible.findIndex((field) => field.id === active?.id),
        0
      )
      const direction = event.key === "ArrowRight" ? 1 : -1
      const next =
        visible[(currentIndex + direction + visible.length) % visible.length]
      if (next) select(next.slug)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [active?.id, select, visible])

  // CLAUDE.md: the Clerk auth control lives in the page header on every page,
  // no exceptions — including these early-return states, which used to skip
  // straight to a bare <main> and drop the header (and the logo) entirely.
  if (loading) {
    return (
      <main className="min-h-screen bg-[#101010] text-white">
        <EmptyStateHeader />
      </main>
    )
  }
  if (!active) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-black text-white">
        <EmptyStateVideoBackground />
        {/* Same scrim treatment as the active-field view below: without it,
            text sitting directly on the video is unreadable whenever a
            bright/busy frame plays underneath. */}
        <div className="pointer-events-none fixed inset-0 z-[1] bg-[linear-gradient(180deg,rgba(0,0,0,.46),transparent_22%,transparent_66%,rgba(0,0,0,.5)),linear-gradient(90deg,rgba(4,8,14,.38),rgba(4,8,14,.08)_48%,rgba(4,8,14,.36))]" />
        <div className="pointer-events-none fixed inset-0 z-[2] bg-[radial-gradient(ellipse_at_50%_48%,rgba(0,0,0,.46),rgba(0,0,0,.12)_45%,transparent_70%)]" />
        <div className="relative z-10 grid min-h-screen grid-rows-[auto_1fr]">
          <EmptyStateHeader />
          <div className="grid place-items-center px-6 text-center">
            <p className="rounded-full border border-white/20 bg-black/55 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-sm [text-shadow:0_2px_8px_rgba(0,0,0,.95)]">
              Chưa có lĩnh vực đã xuất bản.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const index = Math.max(
    visible.findIndex((field) => field.id === active.id),
    0
  )
  const fieldRoadmaps =
    roadmaps?.filter((roadmap) =>
      roadmap.fields.some((field) => field.id === active.id)
    ) ?? []
  const roadmapCount = fieldRoadmaps.length
  // The navigation contract lives in `fieldRoadmapCta`, which is tested against
  // all three cases. Building the href inline here meant the Field Roadmaps
  // page was unreachable from the Explorer — the contract's primary entry
  // point — and the single-roadmap case pointed at the legacy singular route.
  const cta = fieldRoadmapCta(active, fieldRoadmaps)
  const backgroundStyle = (field: Field) => ({
    backgroundImage: `url(${field.imageUrl || FALLBACK_IMAGE})`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  })

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#101010] text-white">
      {/* Two fixed layers avoid layout movement while an image changes, like the Lumina gallery reference. */}
      {outgoingBackground && (
        <div
          className="field-bg field-bg-out"
          style={backgroundStyle(outgoingBackground)}
          aria-hidden="true"
        />
      )}
      {background && (
        <div
          ref={backdropRef}
          key={background.id}
          className={cn("field-bg", outgoingBackground && "field-bg-in")}
          style={
            {
              ...backgroundStyle(background),
              "--field-origin": transitionOrigin,
            } as CSSProperties
          }
          aria-hidden="true"
        />
      )}
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[linear-gradient(180deg,rgba(0,0,0,.5),transparent_28%,transparent_62%,rgba(0,0,0,.62)),linear-gradient(90deg,rgba(4,8,14,.82),rgba(4,8,14,.54)_42%,rgba(4,8,14,.14)_72%,rgba(4,8,14,.34))]" />
      <div className="pointer-events-none fixed inset-0 z-[2] bg-[radial-gradient(ellipse_at_50%_48%,rgba(0,0,0,.46),rgba(0,0,0,.12)_45%,transparent_70%)]" />

      <header className="relative z-10 flex h-16 items-center justify-between bg-gradient-to-b from-black/45 to-transparent px-5 sm:px-8">
        <Link
          href="/"
          className="rounded-md text-xl font-extrabold tracking-[-1px] text-white outline-none [text-shadow:0_2px_12px_rgba(0,0,0,.92)] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-black"
        >
          Tlh222k
        </Link>
        <AuthHeader tone="on-dark" minimal />
      </header>

      <section
        className={cn(
          "relative z-10 mx-auto flex min-h-[calc(100svh-64px)] w-full max-w-7xl items-center justify-center px-5 py-16 text-center sm:px-8 lg:px-12",
          visible.length > 1 && "pb-36"
        )}
      >
        <div className="max-w-2xl">
          <p className="inline-flex rounded-full border border-white/20 bg-black/55 px-3 py-1 text-[11px] font-bold tracking-[.12em] text-white shadow-lg backdrop-blur-sm [text-shadow:0_2px_8px_rgba(0,0,0,.95)]">
            LĨNH VỰC {index + 1} / {visible.length}{" "}
            <span className="mx-2 text-white/80">—</span> {roadmapCount} ROADMAP
          </p>
          <h1 className="mt-5 max-w-2xl text-5xl leading-[.94] font-black tracking-[-.055em] text-white [text-shadow:0_4px_18px_rgba(0,0,0,.98),0_0_2px_rgba(0,0,0,1)] sm:text-7xl lg:text-[clamp(4.5rem,7vw,6.5rem)]">
            {active.title}
          </h1>
          <p className="mx-auto mt-6 line-clamp-4 max-w-xl rounded-2xl border border-white/10 bg-black/60 px-5 py-4 text-base leading-7 font-medium [overflow-wrap:anywhere] text-white shadow-xl backdrop-blur-sm [text-shadow:0_2px_10px_rgba(0,0,0,.98)] sm:text-lg">
            {active.description ||
              "Khám phá các roadmap được tuyển chọn trong lĩnh vực này."}
          </p>
          {cta.href ? (
            <Link
              href={cta.href}
              className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#ff385c] px-6 py-4 text-sm font-bold shadow-[0_10px_30px_rgba(255,56,92,.22)] transition outline-none hover:-translate-y-0.5 hover:bg-[#e31c5f] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-black"
            >
              {cta.label} <ArrowRight className="size-4" />
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="mt-8 inline-flex items-center rounded-full border border-white/25 bg-black/45 px-5 py-3 text-sm font-semibold text-white/85 backdrop-blur-sm"
            >
              Roadmap đang được cập nhật
            </span>
          )}
        </div>
      </section>

      {visible.length > 1 && (
        <nav
          aria-label="Lĩnh vực"
          className="absolute inset-x-0 bottom-7 z-10 mx-auto flex w-fit max-w-[calc(100%-32px)] gap-2 overflow-x-auto rounded-[22px] border border-white/45 bg-[#101318]/95 p-2 shadow-2xl backdrop-blur [scrollbar-width:none] sm:bottom-8 [&::-webkit-scrollbar]:hidden"
        >
          {visible.map((field) => (
            <button
              key={field.id}
              type="button"
              onClick={(event) =>
                select(field.slug, `${event.clientX}px ${event.clientY}px`)
              }
              aria-label={`Chuyển sang lĩnh vực ${field.title}`}
              aria-pressed={field.id === active.id}
              className={cn(
                "group w-[76px] shrink-0 overflow-hidden rounded-xl border border-white/35 bg-black/20 text-left transition outline-none hover:border-white/70 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#101318] sm:w-[82px]",
                field.id === active.id &&
                  "border-[#ff385c] ring-1 ring-[#ff385c]"
              )}
            >
              <span className="block truncate px-2 pt-1.5 text-center text-[10px] font-bold text-white [text-shadow:0_1px_5px_rgba(0,0,0,.95)]">
                {field.title}
              </span>
              <span
                className="m-1 mt-1.5 flex h-11 items-center justify-center rounded-lg bg-white/20 text-white/90"
                style={
                  field.imageUrl
                    ? {
                        backgroundImage: `linear-gradient(#0003,#0003),url(${field.imageUrl})`,
                        backgroundPosition: "center",
                        backgroundSize: "cover",
                      }
                    : undefined
                }
              >
                {!field.imageUrl && <ScanLine className="size-4" />}
              </span>
            </button>
          ))}
        </nav>
      )}
      <p className="sr-only" aria-live="polite">
        Đang xem lĩnh vực {active.title}
      </p>
      <style jsx>{`
        .field-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          transform: scale(1.035);
          filter: saturate(0.92) contrast(1.04);
        }
        .field-bg-out {
          z-index: 0;
          animation: field-fade-out 760ms ease both;
        }
        .field-bg-in {
          z-index: 1;
          animation: field-reveal 760ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        @keyframes field-reveal {
          from {
            clip-path: circle(0% at var(--field-origin, 50% 50%));
            opacity: 0.35;
            transform: scale(1.09);
          }
          to {
            clip-path: circle(150% at var(--field-origin, 50% 50%));
            opacity: 1;
            transform: scale(1.035);
          }
        }
        @keyframes field-fade-out {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .field-bg,
          .field-bg-in,
          .field-bg-out {
            animation: none;
            transform: none;
          }
        }
      `}</style>
    </main>
  )
}

/**
 * Header for loading / empty states: home link and Clerk only.
 */
function EmptyStateHeader() {
  return (
    <header className="flex h-16 items-center justify-between bg-gradient-to-b from-black/45 to-transparent px-5 sm:px-8">
      <Link
        href="/"
        className="rounded-md text-xl font-extrabold tracking-[-1px] text-white outline-none [text-shadow:0_2px_12px_rgba(0,0,0,.92)] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-black"
      >
        Tlh222k
      </Link>
      <AuthHeader tone="on-dark" minimal />
    </header>
  )
}

const EMPTY_STATE_VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4"

/**
 * Full-viewport muted autoplay video for the no-published-field state.
 * Loops itself via a manual fade (not the native `loop` attribute) so the
 * loop point gets a 500ms crossfade instead of a hard cut: fades in on
 * load/loop-restart, starts fading out 0.55s before the clip ends, and on
 * `ended` snaps to 0 opacity, rewinds, and fades back in. Each fade resumes
 * from the video's current opacity rather than snapping to 0/1, so a fade-out
 * interrupted by a new event doesn't visibly jump.
 */
function EmptyStateVideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const fadingOutRef = useRef(false)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const cancelFade = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }

    const fadeTo = (target: number, duration: number) => {
      cancelFade()
      const current = Number.parseFloat(video.style.opacity)
      const from = Number.isNaN(current) ? (target === 1 ? 0 : 1) : current
      const start = performance.now()
      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1)
        video.style.opacity = String(from + (target - from) * t)
        rafRef.current = t < 1 ? requestAnimationFrame(tick) : null
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    const handleLoadedData = () => fadeTo(1, 500)

    const handleTimeUpdate = () => {
      if (fadingOutRef.current) return
      const remaining = video.duration - video.currentTime
      if (!Number.isNaN(remaining) && remaining <= 0.55) {
        fadingOutRef.current = true
        fadeTo(0, 500)
      }
    }

    const handleEnded = () => {
      video.style.opacity = "0"
      window.setTimeout(() => {
        fadingOutRef.current = false
        video.currentTime = 0
        void video.play()
        fadeTo(1, 500)
      }, 100)
    }

    video.addEventListener("loadeddata", handleLoadedData)
    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("ended", handleEnded)
    return () => {
      cancelFade()
      video.removeEventListener("loadeddata", handleLoadedData)
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("ended", handleEnded)
    }
  }, [])

  return (
    <video
      ref={videoRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full translate-y-[17%] object-cover opacity-0"
      src={EMPTY_STATE_VIDEO_URL}
      muted
      autoPlay
      playsInline
    />
  )
}
