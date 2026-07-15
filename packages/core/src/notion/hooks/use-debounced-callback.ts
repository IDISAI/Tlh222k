"use client"

import { useEffect, useMemo, useRef } from "react"

/**
 * Debounced stable callback — used for BlockNote autosave so every keystroke
 * doesn't hit the update Server Action.
 */
export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  ms = 600
): (...args: A) => void {
  const fnRef = useRef(fn)
  fnRef.current = fn
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  return useMemo(
    () =>
      (...args: A) => {
        clearTimeout(timer.current)
        timer.current = setTimeout(() => fnRef.current(...args), ms)
      },
    [ms]
  )
}
