"use client"

import { useState } from "react"
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
  if (dismissed) return null

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
            onClick={() => setDismissed(true)}
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
