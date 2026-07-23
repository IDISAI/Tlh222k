"use client"

import { useCallback, useSyncExternalStore } from "react"

/**
 * Tracks a CSS media query, live.
 *
 * `useSyncExternalStore` rather than state-in-an-effect: `matchMedia` IS an
 * external store, so this subscribes to it directly instead of mirroring it
 * into React state (which costs a second render on mount and trips React's
 * cascading-render warning). The server snapshot is always `false`, so markup
 * matches on hydration and anything gated on this starts in its "off" branch.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener("change", onStoreChange)
      return () => mql.removeEventListener("change", onStoreChange)
    },
    [query]
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  )
}
