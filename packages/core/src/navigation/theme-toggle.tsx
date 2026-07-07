"use client"

import { useEffect, useState } from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

// Cycle light → dark → system → light (Req 14.1). `theme` (not `resolvedTheme`)
// is used so "system" is a distinct, selectable state.
const CYCLE = ["light", "dark", "system"] as const
type ThemeChoice = (typeof CYCLE)[number]

function isThemeChoice(value: string | undefined): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "system"
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Theme is only known on the client; render a stable icon until mounted to
  // avoid a hydration mismatch.
  useEffect(() => setMounted(true), [])

  const resolved: ThemeChoice = isThemeChoice(theme) ? theme : "system"
  // Pin the displayed value to "system" until mounted so the client's first
  // render matches the server, regardless of when next-themes resolves the
  // real stored theme (Property: no hydration mismatch).
  const current: ThemeChoice = mounted ? resolved : "system"
  const next: ThemeChoice = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length]!

  const Icon = !mounted
    ? Monitor
    : current === "light"
      ? Sun
      : current === "dark"
        ? Moon
        : Monitor

  return (
    <button
      type="button"
      aria-label={`Theme: ${current}. Switch to ${next}.`}
      title={`Theme: ${current}`}
      onClick={() => setTheme(next)}
      className="inline-flex size-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Icon className="size-4" />
    </button>
  )
}
