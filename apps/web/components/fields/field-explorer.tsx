"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import Link from "next/link"
import gsap from "gsap"
import {
  ArrowRight,
  Columns3,
  Maximize2,
  Minimize2,
  Moon,
  PanelsTopLeft,
  ScanLine,
} from "lucide-react"
import { RoadmapService, type Field, useFields, useRoadmap } from "@workspace/core"
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
  const [outgoingBackground, setOutgoingBackground] = useState<Field | null>(null)
  const [transitionOrigin, setTransitionOrigin] = useState("50% 50%")
  const [reducedMotion, setReducedMotion] = useState(false)
  const [zen, setZen] = useState(false)
  const [galleryRail, setGalleryRail] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const explorerRef = useRef<HTMLElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const active = visible.find((field) => field.slug === activeSlug) ?? directField ?? visible[0]

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("field")
    if (slug && visible.some((field) => field.slug === slug)) setActiveSlug(slug)
    else if (slug) setActiveSlug(slug)
  }, [visible])

  useEffect(() => {
    if (!activeSlug || visible.some((field) => field.slug === activeSlug)) {
      setDirectField(null)
      return
    }
    let cancelled = false
    void service.fieldBySlug(activeSlug).then((field) => {
      if (!cancelled) setDirectField(field)
    }).catch(() => {
      if (!cancelled) setDirectField(null)
    })
    return () => { cancelled = true }
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
      transitionTimer = window.setTimeout(() => setOutgoingBackground(null), 760)
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
      gsap.fromTo(layer, { opacity: 0.35, scale: 1.09 }, { opacity: 1, scale: 1.035, duration: 0.76, ease: "power3.out", overwrite: true })
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
      if (!visible.length || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return
      const currentIndex = Math.max(visible.findIndex((field) => field.id === active?.id), 0)
      const direction = event.key === "ArrowRight" ? 1 : -1
      const next = visible[(currentIndex + direction + visible.length) % visible.length]
      if (next) select(next.slug)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [active?.id, select, visible])

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === explorerRef.current)
    syncFullscreen()
    document.addEventListener("fullscreenchange", syncFullscreen)
    return () => document.removeEventListener("fullscreenchange", syncFullscreen)
  }, [])

  const requestFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await explorerRef.current?.requestFullscreen?.()
      else await document.exitFullscreen?.()
    } catch {
      // Fullscreen can be denied by browser policy; Explorer remains usable.
    }
  }

  if (loading) return <main className="min-h-screen bg-[#101010]" />
  if (!active) {
    return <main className="grid min-h-screen place-items-center bg-[#101010] px-6 text-center text-sm text-white/65">Chưa có lĩnh vực đã xuất bản.</main>
  }

  const index = Math.max(visible.findIndex((field) => field.id === active.id), 0)
  const fieldRoadmaps = roadmaps?.filter((roadmap) => roadmap.fields.some((field) => field.id === active.id)) ?? []
  const roadmapCount = fieldRoadmaps.length
  const fieldHref = roadmapCount === 1 && fieldRoadmaps[0] ? `/roadmap/${fieldRoadmaps[0].id}` : `/roadmaps?field=${encodeURIComponent(active.slug)}`
  const rail = zen || galleryRail
  const selectByIndex = (nextIndex: number) => {
    const next = visible[nextIndex]
    if (next) select(next.slug)
  }

  const backgroundStyle = (field: Field) => ({
    backgroundImage: `url(${field.imageUrl || FALLBACK_IMAGE})`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  })

  return (
    <main ref={explorerRef} className={cn("relative min-h-screen overflow-hidden bg-[#101010] text-white", isFullscreen && "h-screen", zen && "field-explorer-zen")}>
      {/* Two fixed layers avoid layout movement while an image changes, like the Lumina gallery reference. */}
      {outgoingBackground && <div className="field-bg field-bg-out" style={backgroundStyle(outgoingBackground)} aria-hidden="true" />}
      {background && <div ref={backdropRef} key={background.id} className={cn("field-bg", outgoingBackground && "field-bg-in")} style={{ ...backgroundStyle(background), "--field-origin": transitionOrigin } as CSSProperties} aria-hidden="true" />}
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[linear-gradient(180deg,rgba(0,0,0,.46),transparent_22%,transparent_66%,rgba(0,0,0,.5)),linear-gradient(90deg,rgba(4,8,14,.38),rgba(4,8,14,.08)_48%,rgba(4,8,14,.36))]" />
      <div className="pointer-events-none fixed inset-0 z-[2] bg-[radial-gradient(ellipse_at_50%_48%,rgba(0,0,0,.46),rgba(0,0,0,.12)_45%,transparent_70%)]" />

      <header className="relative z-10 flex h-16 items-center justify-between bg-gradient-to-b from-black/45 to-transparent px-5 sm:px-8">
        <span className="text-xl font-extrabold tracking-[-1px] text-white [text-shadow:0_2px_12px_rgba(0,0,0,.92)]">lh222k</span>
        <div className="flex items-center gap-2 text-xs font-semibold text-white [text-shadow:0_1px_8px_rgba(0,0,0,.95)]"><span className="hidden rounded-full border border-white/55 bg-black/70 p-1 shadow-lg backdrop-blur-sm sm:flex"><button type="button" aria-label="Dock ngang" aria-pressed={!galleryRail} onClick={() => { setGalleryRail(false); setZen(false) }} className={cn("grid size-7 place-items-center rounded-full", !galleryRail && "bg-white/30 text-white")}><PanelsTopLeft className="size-4" /></button><button type="button" aria-label="Rail dọc" aria-pressed={galleryRail} onClick={() => setGalleryRail(true)} className={cn("grid size-7 place-items-center rounded-full", galleryRail && "bg-white/30 text-white")}><Columns3 className="size-4" /></button></span><button type="button" onClick={() => void requestFullscreen()} aria-pressed={isFullscreen} className="flex items-center gap-1.5 rounded-full border border-white/55 bg-black/70 px-3 py-2 shadow-lg backdrop-blur-sm transition hover:bg-black/85">{isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}{isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}</button><button type="button" onClick={() => setZen((value) => { const next = !value; setGalleryRail(next); return next })} aria-pressed={zen} className={cn("hidden items-center gap-1.5 rounded-full border border-white/55 bg-black/70 px-3 py-2 shadow-lg backdrop-blur-sm transition hover:bg-black/85 sm:flex", zen && "bg-white/30 text-white")}><Moon className="size-3.5" />Zen</button><AuthHeader tone="on-dark" /></div>
      </header>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-64px)] max-w-6xl flex-col items-center justify-center px-5 pb-40 text-center">
        <p className="rounded-full border border-white/20 bg-black/55 px-3 py-1 text-[11px] font-bold tracking-[.12em] text-white shadow-lg backdrop-blur-sm [text-shadow:0_2px_8px_rgba(0,0,0,.95)]">LĨNH VỰC {index + 1} / {visible.length} <span className="mx-2 text-white/80">—</span> {roadmapCount} ROADMAP</p>
        <h1 className="mt-5 max-w-5xl text-5xl font-black leading-none tracking-[-.055em] text-white [text-shadow:0_4px_18px_rgba(0,0,0,.98),0_0_2px_rgba(0,0,0,1)] sm:text-7xl lg:text-[72px]">{active.title}</h1>
        <p className="mt-5 max-w-xl rounded-2xl bg-black/58 px-4 py-2 text-base font-medium leading-7 text-white shadow-lg backdrop-blur-sm [text-shadow:0_2px_10px_rgba(0,0,0,.98)]">{active.description || "Khám phá các roadmap được tuyển chọn trong lĩnh vực này."}</p>
        {roadmapCount > 0 ? <Link href={fieldHref} className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#ff385c] px-6 py-4 text-sm font-bold shadow-[0_10px_30px_rgba(255,56,92,.22)] transition hover:bg-[#e31c5f]">{roadmapCount === 1 ? "Khám phá roadmap" : `Xem ${roadmapCount} roadmap`} <ArrowRight className="size-4" /></Link> : <span aria-disabled="true" className="mt-8 inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-[#ffd1da] px-6 py-4 text-sm font-bold text-white">Chưa có roadmap <ArrowRight className="size-4" /></span>}
      </section>

      <nav aria-label="Lĩnh vực" className={cn("absolute inset-x-0 bottom-7 z-10 mx-auto flex w-[calc(100%-32px)] max-w-[760px] gap-2 overflow-x-auto rounded-[22px] border border-white/45 bg-[#101318]/95 p-2 shadow-2xl backdrop-blur transition-all [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:bottom-8", rail && "fixed inset-x-auto bottom-auto left-5 top-1/2 max-h-[calc(100vh-150px)] w-[98px] max-w-none -translate-y-1/2 flex-col overflow-y-auto overflow-x-hidden rounded-[26px]") }>
        {visible.map((field) => <button key={field.id} type="button" onClick={(event) => select(field.slug, `${event.clientX}px ${event.clientY}px`)} aria-label={`Chuyển sang lĩnh vực ${field.title}`} aria-pressed={field.id === active.id} className={cn("group w-[76px] shrink-0 overflow-hidden rounded-xl border border-white/35 bg-black/20 text-left transition hover:border-white/70 sm:w-[82px]", rail && "h-[70px] w-[78px]", field.id === active.id && "border-[#ff385c] ring-1 ring-[#ff385c]")}><span className={cn("block truncate px-2 pt-1.5 text-center text-[10px] font-bold text-white [text-shadow:0_1px_5px_rgba(0,0,0,.95)]", rail && "sr-only")}>{field.title}</span><span className={cn("m-1 mt-1.5 flex h-11 items-center justify-center rounded-lg bg-white/20 text-white/90", rail && "m-1 h-[60px] bg-white/10 text-[10px] font-bold text-white")} style={field.imageUrl ? { backgroundImage: `linear-gradient(#0003,#0003),url(${field.imageUrl})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}>{rail ? field.title.slice(0, 2).toUpperCase() : <ScanLine className="size-4" />}</span></button>)}
      </nav>
      {rail && <div className="fixed bottom-5 left-1/2 z-10 flex w-[min(58vw,620px)] -translate-x-1/2 items-center gap-2 rounded-full bg-black/45 px-3 py-2 shadow-lg backdrop-blur-sm"><input aria-label="Chọn lĩnh vực trong gallery" type="range" min={0} max={Math.max(visible.length - 1, 0)} value={index} onChange={(event) => selectByIndex(Number(event.target.value))} className="h-1 flex-1 cursor-pointer accent-[#ff385c]" /><span className="text-[10px] font-bold text-white">{index + 1}/{visible.length}</span></div>}
      <p className="sr-only" aria-live="polite">Đang xem lĩnh vực {active.title}</p>
      <style jsx>{`
        .field-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; transform: scale(1.035); filter: saturate(.92) contrast(1.04); }
        .field-bg-out { z-index: 0; animation: field-fade-out 760ms ease both; }
        .field-bg-in { z-index: 1; animation: field-reveal 760ms cubic-bezier(.2,.8,.2,1) both; }
        @keyframes field-reveal { from { clip-path: circle(0% at var(--field-origin, 50% 50%)); opacity: .35; transform: scale(1.09); } to { clip-path: circle(150% at var(--field-origin, 50% 50%)); opacity: 1; transform: scale(1.035); } }
        @keyframes field-fade-out { from { opacity: 1; } to { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .field-bg, .field-bg-in, .field-bg-out { animation: none; transform: none; } }
      `}</style>
    </main>
  )
}
