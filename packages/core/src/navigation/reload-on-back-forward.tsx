"use client"

import { useEffect } from "react"

/**
 * Force a fresh load when the browser lands on this page via Back/Forward.
 *
 * The roadmap builder navigates with full page loads (`window.location.assign`
 * — cross-zone-safe by design). Browser Back then restores the document from
 * the HTTP cache; in dev the cached HTML can reference stale hashed chunks, so
 * React never hydrates and client-fetched pages freeze on their skeleton.
 * Reloading on chunk-load errors / dispatching on bfcache restore fixes both.
 *
 * Attaches its listeners from a `useEffect` (returns null, renders nothing).
 * The old version rendered an inline `<script>` so it ran pre-hydration, but
 * React 19 warns on ANY `<script>` a component renders ("Encountered a script
 * tag while rendering React component"). ponytail: post-hydration attachment
 * loses pre-hydration chunk-error recovery (dev-only edge case); acceptable to
 * kill the warning. bfcache `pageshow` still works — the listener is mounted
 * before any back/forward navigation fires it.
 */
export function ReloadOnBackForward() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      const msg = e.message || ""
      if (
        msg.indexOf("chunk") > -1 ||
        msg.indexOf("Loading CSS") > -1 ||
        msg.indexOf("Loading chunk") > -1
      ) {
        location.reload()
      }
    }
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        window.dispatchEvent(new CustomEvent("bfcache-restore"))
      }
    }
    window.addEventListener("error", onError, true)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      window.removeEventListener("error", onError, true)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [])

  return null
}
