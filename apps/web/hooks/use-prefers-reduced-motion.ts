"use client"

import { useMediaQuery } from "@/hooks/use-media-query"

/** Tracks the OS "reduce motion" setting, live. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)")
}
