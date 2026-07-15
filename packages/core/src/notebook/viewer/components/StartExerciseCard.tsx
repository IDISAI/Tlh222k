"use client"

import { useEffect, useState } from "react"
import { NotebookPen } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

export interface StartExerciseCardProps {
  exerciseTitle: string
  onStart: () => void
}

/** Floating bottom-right "Your turn" card (Kaggle Learn style). */
export function StartExerciseCard({
  exerciseTitle,
  onStart,
}: StartExerciseCardProps) {
  const [dismissed, setDismissed] = useState(false)
  // Reveal only once the reader reaches the end of the tutorial — signals
  // they've finished reading before nudging them to the exercise.
  const [reached, setReached] = useState(false)

  // Keep the dismissal sticky for the session so a remount (tab switch, kernel
  // status re-render) doesn't resurrect the card on the next scroll.
  const storageKey = `start-exercise-dismissed:${exerciseTitle}`
  useEffect(() => {
    if (sessionStorage.getItem(storageKey)) setDismissed(true)
  }, [storageKey])

  const dismiss = () => {
    sessionStorage.setItem(storageKey, "1")
    setDismissed(true)
  }

  useEffect(() => {
    if (reached) return
    const check = () => {
      const scrolled = window.innerHeight + window.scrollY
      if (scrolled >= document.documentElement.scrollHeight - 120) {
        setReached(true)
      }
    }
    check() // short pages may already be at the bottom
    window.addEventListener("scroll", check, { passive: true })
    window.addEventListener("resize", check)
    return () => {
      window.removeEventListener("scroll", check)
      window.removeEventListener("resize", check)
    }
  }, [reached])

  if (dismissed || !reached) return null

  return (
    <div className="fixed bottom-6 right-6 z-40 flex max-w-sm gap-3 rounded-xl border bg-background p-4 shadow-lg">
      <NotebookPen className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold">Your turn</p>
          <p className="text-sm text-muted-foreground">
            Try the exercise: {exerciseTitle}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={dismiss}
          >
            Not now
          </Button>
          <Button type="button" size="sm" onClick={onStart}>
            Start Exercise
          </Button>
        </div>
      </div>
    </div>
  )
}
