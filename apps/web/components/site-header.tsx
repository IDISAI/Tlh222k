"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ThemeToggle } from "@workspace/core"
import { cn } from "@workspace/ui/lib/utils"

import { AuthHeader } from "@/components/auth-header"

/** Sticky top bar that deepens its shadow once the page scrolls, signaling
 *  the content passing beneath. Passive scroll listener, no library. */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={cn(
        "sticky top-0 z-50 flex items-center justify-between border-b-2 border-black bg-background/95 px-5 py-3 backdrop-blur-sm transition-shadow duration-200 dark:border-zinc-700",
        scrolled &&
          "shadow-[0_3px_0_0_rgba(0,0,0,0.9)] dark:shadow-[0_3px_0_0_rgba(255,255,255,0.15)]"
      )}
    >
      <Link
        href="/"
        className="font-heading text-base font-black uppercase italic tracking-tight transition-opacity hover:opacity-70"
      >
        lh222k
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <AuthHeader />
      </div>
    </header>
  )
}
