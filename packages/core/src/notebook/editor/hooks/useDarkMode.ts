"use client"

import { useSyncExternalStore } from "react"

// The app toggles dark mode by adding/removing `dark` on <html>, so that is the
// only thing to watch. Shared by both cell editors: they used to read the class
// once at mount and keep the old palette until the cell remounted.

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  })
  return () => observer.disconnect()
}

const isDark = () => document.documentElement.classList.contains("dark")

/** True while the document is in dark mode; re-renders when that changes. */
export function useDarkMode(): boolean {
  // Server render has no document; light is the safe first paint, and the
  // subscription corrects it on hydration.
  return useSyncExternalStore(subscribe, isDark, () => false)
}
